/**
 * Runs before every test file (vitest setupFiles), ahead of any import of
 * src/config/env.ts or src/db/index.ts, so each file gets its own throwaway
 * SQLite database and certificate directory under the OS temp dir. The real
 * server/campusconnect.db and server/storage/certificates are never touched.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import pg from 'pg';

const root = path.join(os.tmpdir(), 'campusconnect-tests');
fs.mkdirSync(root, { recursive: true });
const workDir = fs.mkdtempSync(path.join(root, `run-${process.pid}-`));

process.env.NODE_ENV = 'test';
process.env.SQLITE_DB_PATH = path.join(workDir, 'test.db');
process.env.CERT_STORAGE_DIR = path.join(workDir, 'certificates');

// Set TEST_DATABASE_URL to run the suite on PostgreSQL. Each test file then gets its own
// schema (created by the migration runner) which is dropped once the file finishes.
const testPgUrl = process.env.TEST_DATABASE_URL;
const pgSchema = testPgUrl ? `t_${process.pid}_${Date.now().toString(36)}` : null;
if (testPgUrl && pgSchema) {
  process.env.DATABASE_URL = testPgUrl;
  process.env.DATABASE_SCHEMA = pgSchema;
  process.env.DATABASE_SSL = 'disable';
} else {
  process.env.DATABASE_URL = '';
  process.env.DATABASE_SCHEMA = '';
}
process.env.CERT_SIGNING_KEY_DIR = path.join(workDir, 'keys');

afterAll(async () => {
  if (!testPgUrl || !pgSchema) return;
  const client = new pg.Client({ connectionString: testPgUrl });
  await client.connect();
  try {
    await client.query(`DROP SCHEMA IF EXISTS "${pgSchema}" CASCADE`);
  } finally {
    await client.end();
  }
});
