import { AsyncLocalStorage } from 'async_hooks';
import Database from 'better-sqlite3';
import pg from 'pg';
import { env } from '../config/env.js';
import { runSqliteMigrations } from './migrate.js';

const { Pool } = pg;

export type DbRow = Record<string, unknown>;
export type DbParams = readonly unknown[];

export interface DbClient {
  query<T = DbRow>(text: string, params?: DbParams): Promise<T[]>;
  queryOne<T = DbRow>(text: string, params?: DbParams): Promise<T | null>;
  execute(text: string, params?: DbParams): Promise<{ rowCount: number }>;
}

const SQLITE_BUSY_TIMEOUT_MS = 5000;

/** Rewrites $1-style placeholders to ? and expands repeated references. */
export function toSqlitePlaceholders(text: string, params: DbParams): { sql: string; values: unknown[] } {
  if (!/\$\d+/.test(text)) {
    return { sql: text, values: [...params] };
  }
  const values: unknown[] = [];
  const sql = text.replace(/\$(\d+)/g, (_, num: string) => {
    values.push(params[parseInt(num, 10) - 1]);
    return '?';
  });
  return { sql, values };
}

/** Thin synchronous executor over one better-sqlite3 connection. */
class SqliteRunner {
  constructor(private readonly sqlite: Database.Database) {}

  all<T>(text: string, params: DbParams): T[] {
    const { sql, values } = toSqlitePlaceholders(text, params);
    return this.sqlite.prepare(sql).all(...values) as T[];
  }

  run(text: string, params: DbParams): { rowCount: number } {
    const { sql, values } = toSqlitePlaceholders(text, params);
    return { rowCount: this.sqlite.prepare(sql).run(...values).changes };
  }

  exec(sql: string): void {
    this.sqlite.exec(sql);
  }

  client(): DbClient {
    return {
      query: async <T = DbRow>(t: string, p: DbParams = []) => this.all<T>(t, p),
      queryOne: async <T = DbRow>(t: string, p: DbParams = []) => this.all<T>(t, p)[0] ?? null,
      execute: async (t: string, p: DbParams = []) => this.run(t, p)
    };
  }
}

function pgClient(client: pg.PoolClient | pg.Pool): DbClient {
  return {
    query: async <T = DbRow>(t: string, p: DbParams = []) => (await client.query(t, [...p])).rows as T[],
    queryOne: async <T = DbRow>(t: string, p: DbParams = []) =>
      ((await client.query(t, [...p])).rows[0] as T | undefined) ?? null,
    execute: async (t: string, p: DbParams = []) => ({ rowCount: (await client.query(t, [...p])).rowCount ?? 0 })
  };
}

function openSqlite(dbPath: string): Database.Database {
  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma(`busy_timeout = ${SQLITE_BUSY_TIMEOUT_MS}`);
  runSqliteMigrations(sqlite);
  return sqlite;
}

class DatabaseManager implements DbClient {
  private readonly pgPool: pg.Pool | null;
  private readonly sqlite: SqliteRunner | null;
  private readonly sqliteDb: Database.Database | null;
  /** Tail of the transaction queue; each transaction awaits its predecessor. */
  private sqliteTxQueue: Promise<void> = Promise.resolve();
  /** Resolves when the currently open SQLite transaction finishes; null when idle. */
  private activeTx: Promise<void> | null = null;
  /** Identifies the async context that owns the open SQLite transaction. */
  private readonly txContext = new AsyncLocalStorage<Promise<void>>();

  constructor() {
    const dbUrl = env.DATABASE_URL;
    if (dbUrl && dbUrl.startsWith('postgres')) {
      this.pgPool = new Pool({ connectionString: dbUrl });
      this.sqliteDb = null;
      this.sqlite = null;
      console.log('Using PostgreSQL database:', dbUrl.split('@')[1] || 'localhost');
    } else {
      this.pgPool = null;
      this.sqliteDb = openSqlite(env.SQLITE_DB_PATH);
      this.sqlite = new SqliteRunner(this.sqliteDb);
    }
  }

  /**
   * Waits until no SQLite transaction is open, so statements from unrelated
   * requests never join (and get rolled back with) another request's
   * transaction. Calls made from inside the owning transaction's async
   * context run immediately to avoid self-deadlock.
   */
  private async waitForSqliteIdle(): Promise<void> {
    while (this.activeTx && this.txContext.getStore() !== this.activeTx) {
      await this.activeTx;
    }
  }

  private async withSqlite<T>(fn: (runner: SqliteRunner) => T): Promise<T> {
    if (!this.sqlite) throw new Error('Database not initialized');
    await this.waitForSqliteIdle();
    return fn(this.sqlite);
  }

  public async query<T = DbRow>(text: string, params: DbParams = []): Promise<T[]> {
    if (this.pgPool) return pgClient(this.pgPool).query<T>(text, params);
    return this.withSqlite((r) => r.all<T>(text, params));
  }

  public async queryOne<T = DbRow>(text: string, params: DbParams = []): Promise<T | null> {
    const rows = await this.query<T>(text, params);
    return rows[0] ?? null;
  }

  public async execute(text: string, params: DbParams = []): Promise<{ rowCount: number }> {
    if (this.pgPool) return pgClient(this.pgPool).execute(text, params);
    return this.withSqlite((r) => r.run(text, params));
  }

  public async transaction<T>(callback: (trx: DbClient) => Promise<T>): Promise<T> {
    if (this.pgPool) return this.pgTransaction(this.pgPool, callback);
    if (this.sqlite) return this.sqliteTransaction(this.sqlite, callback);
    throw new Error('Database not initialized');
  }

  private async pgTransaction<T>(pool: pg.Pool, callback: (trx: DbClient) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(pgClient(client));
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK').catch((rollbackErr: unknown) => {
        console.error('[db] PostgreSQL ROLLBACK failed:', rollbackErr);
      });
      throw err;
    } finally {
      client.release();
    }
  }

  private async sqliteTransaction<T>(runner: SqliteRunner, callback: (trx: DbClient) => Promise<T>): Promise<T> {
    let releaseLock: () => void = () => undefined;
    const done = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    const previous = this.sqliteTxQueue;
    this.sqliteTxQueue = done;

    await previous;
    this.activeTx = done;
    try {
      runner.exec('BEGIN IMMEDIATE');
      return await this.runSqliteCallback(runner, done, callback);
    } finally {
      this.activeTx = null;
      releaseLock();
    }
  }

  private async runSqliteCallback<T>(
    runner: SqliteRunner,
    token: Promise<void>,
    callback: (trx: DbClient) => Promise<T>
  ): Promise<T> {
    try {
      const result = await this.txContext.run(token, () => callback(runner.client()));
      runner.exec('COMMIT');
      return result;
    } catch (err) {
      try {
        runner.exec('ROLLBACK');
      } catch (rollbackErr) {
        console.error('[db] SQLite ROLLBACK failed:', rollbackErr);
      }
      throw err;
    }
  }

  /** Test hook: the raw better-sqlite3 handle (null on PostgreSQL). */
  public rawSqlite(): Database.Database | null {
    return this.sqliteDb;
  }

  public async close(): Promise<void> {
    if (this.pgPool) await this.pgPool.end();
    if (this.sqliteDb) this.sqliteDb.close();
  }
}

export const db = new DatabaseManager();
