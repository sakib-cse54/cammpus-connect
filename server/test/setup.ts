/**
 * Runs before every test file (vitest setupFiles), ahead of any import of
 * src/config/env.ts or src/db/index.ts, so each file gets its own throwaway
 * SQLite database and certificate directory under the OS temp dir. The real
 * server/campusconnect.db and server/storage/certificates are never touched.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';

const root = path.join(os.tmpdir(), 'campusconnect-tests');
fs.mkdirSync(root, { recursive: true });
const workDir = fs.mkdtempSync(path.join(root, `run-${process.pid}-`));

process.env.NODE_ENV = 'test';
process.env.SQLITE_DB_PATH = path.join(workDir, 'test.db');
process.env.CERT_STORAGE_DIR = path.join(workDir, 'certificates');
delete process.env.DATABASE_URL;
process.env.CERT_SIGNING_KEY_DIR = path.join(workDir, 'keys');
