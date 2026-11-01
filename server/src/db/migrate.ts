import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type Database from 'better-sqlite3';
import type pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATION_FILE = /^(\d{3,})_[a-z0-9_]+\.sql$/i;

export interface Migration {
  readonly version: string;
  readonly name: string;
  readonly sql: string;
}

export type Dialect = 'sqlite' | 'postgres';

/**
 * Locates the migrations directory for a dialect. SQLite files live in
 * src/db/migrations, PostgreSQL files in its postgres/ subfolder. Under tsx this is the
 * source tree; after `npm run build` the build script copies it to dist/db/migrations.
 * Falls back to the source tree so a dist build without the copy still works in a checkout.
 */
export function resolveMigrationsDir(dialect: Dialect = 'sqlite'): string {
  const sub = dialect === 'postgres' ? ['postgres'] : [];
  const candidates = [
    path.join(__dirname, 'migrations', ...sub),
    path.resolve(__dirname, '..', '..', 'src', 'db', 'migrations', ...sub)
  ];
  const found = candidates.find((dir) => fs.existsSync(dir));
  if (!found) {
    throw new Error(`Migrations directory not found. Looked in: ${candidates.join(', ')}`);
  }
  return found;
}

/** Reads NNN_name.sql files from a directory, ordered by version. */
export function loadMigrations(dir: string): Migration[] {
  return fs
    .readdirSync(dir)
    .filter((file) => MIGRATION_FILE.test(file))
    .sort()
    .map((file) => ({
      version: file.split('_')[0],
      name: file,
      sql: fs.readFileSync(path.join(dir, file), 'utf8')
    }));
}

function ensureMigrationsTable(sqlite: Database.Database): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )
  `);
}

function appliedVersions(sqlite: Database.Database): Set<string> {
  const rows = sqlite.prepare('SELECT version FROM schema_migrations').all() as { version: string }[];
  return new Set(rows.map((r) => r.version));
}

/**
 * Applies pending migrations in order, each inside its own transaction, and
 * records them in schema_migrations. Returns the names of migrations applied.
 */
export function runSqliteMigrations(
  sqlite: Database.Database,
  migrations: readonly Migration[] = loadMigrations(resolveMigrationsDir())
): string[] {
  ensureMigrationsTable(sqlite);
  const done = appliedVersions(sqlite);
  const pending = migrations.filter((m) => !done.has(m.version));
  const record = sqlite.prepare(
    'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)'
  );
  for (const migration of pending) {
    const apply = sqlite.transaction(() => {
      sqlite.exec(migration.sql);
      record.run(migration.version, migration.name, new Date().toISOString());
    });
    try {
      apply.immediate();
    } catch (err) {
      throw new Error(`Migration ${migration.name} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return pending.map((m) => m.name);
}

/** Arbitrary constant: serialises migration runs across processes sharing one database. */
const PG_MIGRATION_LOCK_KEY = 7_262_026;

const PG_SCHEMA_NAME = /^[a-z_][a-z0-9_]{0,62}$/i;

/**
 * Applies pending PostgreSQL migrations in order, each in its own transaction, under a
 * session advisory lock so several server instances can boot at once. When `schema` is
 * given it is created first (the pool's search_path points at it). Returns applied names.
 */
export async function runPostgresMigrations(
  pool: pg.Pool,
  schema?: string,
  migrations: readonly Migration[] = loadMigrations(resolveMigrationsDir('postgres'))
): Promise<string[]> {
  if (schema !== undefined && !PG_SCHEMA_NAME.test(schema)) {
    throw new Error(`Invalid DATABASE_SCHEMA "${schema}": use letters, digits and underscores only`);
  }
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [PG_MIGRATION_LOCK_KEY]);
    try {
      // Inside the lock: CREATE SCHEMA IF NOT EXISTS itself races when two instances boot together.
      if (schema) await client.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
      await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          applied_at TEXT NOT NULL
        )
      `);
      const rows = (await client.query('SELECT version FROM schema_migrations')).rows as { version: string }[];
      const done = new Set(rows.map((r) => r.version));
      const pending = migrations.filter((m) => !done.has(m.version));
      for (const migration of pending) {
        await applyPostgresMigration(client, migration);
      }
      return pending.map((m) => m.name);
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [PG_MIGRATION_LOCK_KEY]);
    }
  } finally {
    client.release();
  }
}

async function applyPostgresMigration(client: pg.PoolClient, migration: Migration): Promise<void> {
  try {
    await client.query('BEGIN');
    await client.query(migration.sql);
    await client.query('INSERT INTO schema_migrations (version, name, applied_at) VALUES ($1, $2, $3)', [
      migration.version,
      migration.name,
      new Date().toISOString()
    ]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw new Error(`Migration ${migration.name} failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}
