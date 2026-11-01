import { describe, it, expect } from 'vitest';
import pg from 'pg';
import { loadMigrations, resolveMigrationsDir, runPostgresMigrations } from '../src/db/migrate.js';
import { db } from '../src/db/index.js';

describe('PostgreSQL migration set', () => {
  const sqlite = loadMigrations(resolveMigrationsDir());
  const postgres = loadMigrations(resolveMigrationsDir('postgres'));

  it('is ordered and gap-free from 001', () => {
    postgres.forEach((m, i) => expect(m.version).toBe(String(i + 1).padStart(3, '0')));
  });

  it('covers every SQLite migration version', () => {
    const pgVersions = new Set(postgres.map((m) => m.version));
    for (const m of sqlite) expect(pgVersions.has(m.version)).toBe(true);
  });

  it('ends with the row level security migration', () => {
    expect(postgres.at(-1)?.name).toBe('009_row_level_security.sql');
  });

  it.each(postgres.map((m) => [m.name, m.sql] as const))('%s has no SQLite-only syntax', (_name, sql) => {
    const executable = sql.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
    expect(executable).not.toMatch(/strftime|\bGLOB\b|AUTOINCREMENT|PRAGMA|datetime\('now'\)|\bREAL\b/i);
  });

  it('every created table is covered by the row level security sweep or created before it', () => {
    const rls = postgres.at(-1)!.sql;
    expect(rls).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(rls).toMatch(/pg_tables WHERE schemaname = current_schema\(\)/);
  });
});

describe.skipIf(!process.env.TEST_DATABASE_URL)('live PostgreSQL schema', () => {
  it('recorded every migration exactly once', async () => {
    const rows = await db.query<{ version: string }>('SELECT version FROM schema_migrations ORDER BY version');
    expect(rows.map((r) => r.version)).toEqual(['001', '002', '003', '004', '005', '006', '007', '008', '009']);
  });

  it('has row level security enabled on every app table', async () => {
    const rows = await db.query<{ relname: string; relrowsecurity: boolean }>(
      `SELECT c.relname, c.relrowsecurity FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = current_schema() AND c.relkind = 'r'`
    );
    expect(rows.length).toBeGreaterThanOrEqual(20);
    expect(rows.filter((r) => !r.relrowsecurity).map((r) => r.relname)).toEqual([]);
  });

  it('returns COUNT and SUM results as numbers, like SQLite', async () => {
    const row = await db.queryOne<{ n: unknown; total: unknown }>(
      'SELECT COUNT(*) AS n, COALESCE(SUM(capacity), 0) AS total FROM venues'
    );
    expect(typeof row?.n).toBe('number');
    expect(typeof row?.total).toBe('number');
  });

  it('is idempotent and safe when two instances migrate a fresh schema at once', async () => {
    const schema = `t_mig_${process.pid}_${Date.now().toString(36)}`;
    const url = process.env.TEST_DATABASE_URL!;
    const poolA = new pg.Pool({ connectionString: url });
    const poolB = new pg.Pool({ connectionString: url });
    for (const pool of [poolA, poolB]) pool.on('connect', (c) => void c.query(`SET search_path TO "${schema}"`));
    try {
      const [a, b] = await Promise.all([runPostgresMigrations(poolA, schema), runPostgresMigrations(poolB, schema)]);
      expect(a.length + b.length).toBe(9);
      expect(await runPostgresMigrations(poolA, schema)).toEqual([]);
      const rows = await poolA.query('SELECT version FROM schema_migrations');
      expect(rows.rowCount).toBe(9);
    } finally {
      await poolA.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await poolA.end();
      await poolB.end();
    }
  });

  it('rejects an unsafe schema name before touching the database', async () => {
    const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
    try {
      await expect(runPostgresMigrations(pool, 'x"; DROP SCHEMA public; --')).rejects.toThrow(/Invalid DATABASE_SCHEMA/);
    } finally {
      await pool.end();
    }
  });
});
