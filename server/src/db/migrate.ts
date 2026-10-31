import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATION_FILE = /^(\d{3,})_[a-z0-9_]+\.sql$/i;

export interface Migration {
  readonly version: string;
  readonly name: string;
  readonly sql: string;
}

/**
 * Locates the migrations directory. Under tsx this is src/db/migrations; after
 * `npm run build` the build script copies it to dist/db/migrations. Falls back
 * to the source tree so a dist build without the copy still works in a checkout.
 */
export function resolveMigrationsDir(): string {
  const candidates = [
    path.join(__dirname, 'migrations'),
    path.resolve(__dirname, '..', '..', 'src', 'db', 'migrations')
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
