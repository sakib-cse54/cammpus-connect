import { describe, it, expect, vi, beforeAll } from 'vitest';
import Database from 'better-sqlite3';
import { db, toSqlitePlaceholders } from '../src/db/index.js';
import { runSqliteMigrations, loadMigrations, resolveMigrationsDir } from '../src/db/migrate.js';

describe.skipIf(Boolean(process.env.TEST_DATABASE_URL))('SQLite transaction robustness', () => {
  beforeAll(async () => {
    await db.execute('CREATE TABLE IF NOT EXISTS tx_probe (id TEXT PRIMARY KEY, note TEXT)');
  });

  it('applies busy_timeout and foreign keys', () => {
    const raw = db.rawSqlite();
    expect(raw?.pragma('busy_timeout', { simple: true })).toBe(5000);
    expect(raw?.pragma('foreign_keys', { simple: true })).toBe(1);
  });

  it('releases the queue when BEGIN throws so the next transaction still runs', async () => {
    const raw = db.rawSqlite()!;
    const spy = vi.spyOn(raw, 'exec').mockImplementationOnce(() => {
      throw new Error('SQLITE_BUSY: simulated');
    });
    await expect(db.transaction(async () => 'never')).rejects.toThrow('simulated');
    spy.mockRestore();
    const result = await db.transaction(async (trx) => {
      await trx.execute('INSERT INTO tx_probe (id, note) VALUES ($1, $2)', ['after-begin-fail', 'ok']);
      return 'ran';
    });
    expect(result).toBe('ran');
  });

  it('an unrelated db.execute issued during a transaction does not get rolled back with it', async () => {
    let markOpen: () => void = () => undefined;
    let finish: () => void = () => undefined;
    const opened = new Promise<void>((resolve) => { markOpen = resolve; });
    const gate = new Promise<void>((resolve) => { finish = resolve; });
    const failing = db.transaction(async (trx) => {
      await trx.execute('INSERT INTO tx_probe (id, note) VALUES ($1, $2)', ['inside-tx', 'rolled back']);
      markOpen();
      await gate;
      throw new Error('business rule failed');
    });
    await opened;
    // Another request (outside the transaction's async context) writes while it is open
    const outside = db.execute('INSERT INTO tx_probe (id, note) VALUES ($1, $2)', ['outside-tx', 'persisted']);
    finish();
    await expect(failing).rejects.toThrow('business rule failed');
    await outside;
    const rows = await db.query<{ id: string }>('SELECT id FROM tx_probe WHERE id IN ($1, $2)', ['inside-tx', 'outside-tx']);
    expect(rows.map((r) => r.id)).toEqual(['outside-tx']);
  });

  it('db calls from inside the transaction callback run in-transaction without deadlock', async () => {
    await expect(
      db.transaction(async (trx) => {
        await trx.execute('INSERT INTO tx_probe (id, note) VALUES ($1, $2)', ['nested-a', 'x']);
        await db.execute('INSERT INTO tx_probe (id, note) VALUES ($1, $2)', ['nested-b', 'x']);
        throw new Error('rollback both');
      })
    ).rejects.toThrow('rollback both');
    const rows = await db.query('SELECT id FROM tx_probe WHERE id LIKE $1', ['nested-%']);
    expect(rows).toHaveLength(0);
  });

  it('logs (instead of swallowing) a failing ROLLBACK', async () => {
    const raw = db.rawSqlite()!;
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const realExec = raw.exec.bind(raw);
    const execSpy = vi.spyOn(raw, 'exec').mockImplementation((sql: string) => {
      realExec(sql);
      if (sql === 'ROLLBACK') throw new Error('rollback exploded');
      return raw;
    });
    await expect(db.transaction(async () => { throw new Error('cb failed'); })).rejects.toThrow('cb failed');
    expect(errSpy).toHaveBeenCalledWith('[db] SQLite ROLLBACK failed:', expect.any(Error));
    errSpy.mockRestore();
    execSpy.mockRestore();
    expect(await db.transaction(async () => 'healthy')).toBe('healthy');
  });

  it('expands repeated $n placeholders', () => {
    expect(toSqlitePlaceholders('SELECT $1, $2, $1', ['a', 'b'])).toEqual({ sql: 'SELECT ?, ?, ?', values: ['a', 'b', 'a'] });
  });
});

describe('migration runner', () => {
  it('applies all migrations once and records them', () => {
    const mem = new Database(':memory:');
    const applied = runSqliteMigrations(mem);
    expect(applied).toEqual(['001_base.sql', '002_indexes_and_fixes.sql', '003_cert_revocation.sql', '004_calendar_venues.sql', '005_checkin_v2.sql', '006_cert_signing.sql', '007_outcomes.sql', '008_timestamp_normalization.sql']);
    expect(runSqliteMigrations(mem)).toEqual([]);
    const cols = mem.prepare('PRAGMA table_info(events)').all() as { name: string }[];
    expect(cols.map((c) => c.name)).toContain('cancellation_reason');
    const idx = mem.prepare("SELECT name FROM sqlite_master WHERE type = 'index'").all() as { name: string }[];
    expect(idx.map((i) => i.name)).toEqual(expect.arrayContaining([
      'idx_attendance_event', 'idx_notifications_user_read', 'idx_memberships_user', 'idx_feedback_event'
    ]));
    mem.close();
  });

  it('upgrades a legacy database created by the old inline bootstrap', () => {
    const mem = new Database(':memory:');
    const [base] = loadMigrations(resolveMigrationsDir());
    mem.exec(base.sql); // tables exist, schema_migrations does not
    mem.prepare("INSERT INTO event_categories (id, name) VALUES ('c1', 'Existing')").run();
    expect(runSqliteMigrations(mem)).toEqual(['001_base.sql', '002_indexes_and_fixes.sql', '003_cert_revocation.sql', '004_calendar_venues.sql', '005_checkin_v2.sql', '006_cert_signing.sql', '007_outcomes.sql', '008_timestamp_normalization.sql']);
    expect(mem.prepare('SELECT COUNT(*) AS n FROM event_categories').get()).toEqual({ n: 1 });
    mem.close();
  });

  it('rolls back a failing migration and reports its name', () => {
    const mem = new Database(':memory:');
    const bad = [{ version: '900', name: '900_bad.sql', sql: 'CREATE TABLE ok_t (id TEXT); SELECT * FROM missing_table;' }];
    expect(() => runSqliteMigrations(mem, bad)).toThrow(/900_bad\.sql/);
    expect(mem.prepare("SELECT name FROM sqlite_master WHERE name = 'ok_t'").get()).toBeUndefined();
    mem.close();
  });
});
