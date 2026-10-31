import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    fileParallelism: false,
    environment: 'node',
    globals: true,
    // test/setup.ts points SQLITE_DB_PATH and CERT_STORAGE_DIR at per-file temp paths
    env: { NODE_ENV: 'test' },
    setupFiles: ['./test/setup.ts']
  }
});
