import { describe, it, expect, vi } from 'vitest';
import { loadEnv, EnvValidationError } from '../src/config/env.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const strong = (seed: string): string => seed.repeat(40).slice(0, 48);

describe('environment configuration', () => {
  it('throws in production when secrets are missing', () => {
    expect(() => loadEnv({ NODE_ENV: 'production' })).toThrow(EnvValidationError);
  });

  it('throws in production when a secret is shorter than 32 chars', () => {
    expect(() =>
      loadEnv({
        NODE_ENV: 'production',
        JWT_SECRET: strong('a'),
        JWT_REFRESH_SECRET: strong('b'),
        QR_HMAC_SECRET: 'too-short'
      })
    ).toThrow(/QR_HMAC_SECRET/);
  });

  it('accepts strong secrets in production', () => {
    const env = loadEnv({
      NODE_ENV: 'production',
      JWT_SECRET: strong('a'),
      JWT_REFRESH_SECRET: strong('b'),
      QR_HMAC_SECRET: strong('c'),
      PORT: '8080'
    });
    expect(env.PORT).toBe(8080);
    expect(env.JWT_SECRET).toBe(strong('a'));
    expect(env.CERT_SIGNING_PRIVATE_KEY).toBeUndefined();
  });

  it('generates distinct random secrets in development with a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const first = loadEnv({ NODE_ENV: 'development' });
    const second = loadEnv({ NODE_ENV: 'development' });
    expect(first.JWT_SECRET.length).toBeGreaterThanOrEqual(32);
    expect(first.JWT_SECRET).not.toBe(second.JWT_SECRET);
    expect(first.JWT_SECRET).not.toBe(first.JWT_REFRESH_SECRET);
    expect(first.JWT_SECRET).not.toBe('campusconnect-jwt-secret-key-2026');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('defaults the test database to memory so the dev DB is never touched', () => {
    const env = loadEnv({ NODE_ENV: 'test' });
    expect(env.SQLITE_DB_PATH).toBe(':memory:');
  });

  it('resolves relative storage paths against the server directory, not the cwd', () => {
    const env = loadEnv({ NODE_ENV: 'test', SQLITE_DB_PATH: './x.db', CERT_STORAGE_DIR: './certs' });
    const serverRoot = path.resolve(__dirname, '..');
    expect(env.SQLITE_DB_PATH).toBe(path.join(serverRoot, 'x.db'));
    expect(env.CERT_STORAGE_DIR).toBe(path.join(serverRoot, 'certs'));
  });

  it('rejects an invalid NODE_ENV', () => {
    expect(() => loadEnv({ NODE_ENV: 'staging' })).toThrow(EnvValidationError);
  });
});
