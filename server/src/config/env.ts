import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** server/ directory, valid from both src/config (tsx) and dist/config (node). */
const SERVER_ROOT = path.resolve(__dirname, '..', '..');
const MIN_SECRET_LENGTH = 32;
const SECRET_KEYS = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'QR_HMAC_SECRET'] as const;

type SecretKey = (typeof SECRET_KEYS)[number];

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.trim().length > 0 ? v : undefined));

const rawSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  PUBLIC_URL: z.string().url().optional().or(z.literal('').transform(() => undefined)),
  DATABASE_URL: optionalString,
  DATABASE_SSL: z.enum(['disable', 'require', 'verify']).optional().or(z.literal('').transform(() => undefined)),
  DATABASE_SSL_CA: optionalString,
  DATABASE_SCHEMA: z.string().regex(/^[a-z_][a-z0-9_]{0,62}$/i, 'letters, digits and underscores only').optional().or(z.literal('').transform(() => undefined)),
  SQLITE_DB_PATH: optionalString,
  CERT_STORAGE_DIR: optionalString,
  JWT_SECRET: optionalString,
  JWT_REFRESH_SECRET: optionalString,
  QR_HMAC_SECRET: optionalString,
  CERT_SIGNING_PRIVATE_KEY: optionalString,
  CERT_SIGNING_KEY_DIR: optionalString
});

type RawEnv = z.infer<typeof rawSchema>;

export interface Env {
  readonly NODE_ENV: 'development' | 'production' | 'test';
  readonly PORT: number;
  readonly CLIENT_URL: string;
  readonly PUBLIC_URL: string | undefined;
  readonly DATABASE_URL: string | undefined;
  /** disable: plain TCP. require: encrypted, certificate not checked. verify: encrypted and checked. Default: require for remote hosts, disable for localhost. */
  readonly DATABASE_SSL: 'disable' | 'require' | 'verify' | undefined;
  /** Path to a PEM CA bundle used when DATABASE_SSL=verify (e.g. the Supabase root certificate). */
  readonly DATABASE_SSL_CA: string | undefined;
  /** Optional PostgreSQL schema to keep the app's tables in (default: the connection's search_path). */
  readonly DATABASE_SCHEMA: string | undefined;
  readonly SQLITE_DB_PATH: string;
  readonly CERT_STORAGE_DIR: string;
  readonly JWT_SECRET: string;
  readonly JWT_REFRESH_SECRET: string;
  readonly QR_HMAC_SECRET: string;
  readonly CERT_SIGNING_PRIVATE_KEY: string | undefined;
  /** Directory for the auto-generated dev/test Ed25519 key (never used in production). */
  readonly CERT_SIGNING_KEY_DIR: string;
}

export class EnvValidationError extends Error {
  constructor(public readonly problems: readonly string[]) {
    super(`Invalid environment configuration:\n- ${problems.join('\n- ')}`);
    this.name = 'EnvValidationError';
  }
}

function parseRaw(source: NodeJS.ProcessEnv): RawEnv {
  const parsed = rawSchema.safeParse(source);
  if (!parsed.success) {
    throw new EnvValidationError(
      parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
    );
  }
  return parsed.data;
}

function resolveSecret(raw: RawEnv, key: SecretKey, generated: SecretKey[]): string {
  const value = raw[key];
  if (value && value.length >= MIN_SECRET_LENGTH) return value;
  if (raw.NODE_ENV === 'production') {
    throw new EnvValidationError([
      `${key}: must be set to at least ${MIN_SECRET_LENGTH} characters in production`
    ]);
  }
  generated.push(key);
  return crypto.randomBytes(48).toString('base64url');
}

function resolveSecrets(raw: RawEnv): Record<SecretKey, string> {
  const generated: SecretKey[] = [];
  const errors: string[] = [];
  const entries = SECRET_KEYS.map((key): [SecretKey, string] => {
    try {
      return [key, resolveSecret(raw, key, generated)];
    } catch (err) {
      if (err instanceof EnvValidationError) errors.push(...err.problems);
      return [key, ''];
    }
  });
  if (errors.length > 0) throw new EnvValidationError(errors);
  if (generated.length > 0 && raw.NODE_ENV !== 'test') {
    console.warn(
      `[env] ${generated.join(', ')} not set (or shorter than ${MIN_SECRET_LENGTH} chars): ` +
        'using random per-process secrets. Tokens will not survive a restart. Set them in server/.env.'
    );
  }
  return Object.fromEntries(entries) as Record<SecretKey, string>;
}

/** Resolves relative paths against server/ so behaviour does not depend on the cwd. */
function fromServerRoot(p: string): string {
  return p === ':memory:' ? p : path.resolve(SERVER_ROOT, p);
}

function defaultDbPath(nodeEnv: RawEnv['NODE_ENV']): string {
  return nodeEnv === 'test' ? ':memory:' : path.join(SERVER_ROOT, 'campusconnect.db');
}

/** Pure loader: validates a raw env map and returns a frozen config. Throws EnvValidationError. */
export function loadEnv(source: NodeJS.ProcessEnv): Env {
  const raw = parseRaw(source);
  const secrets = resolveSecrets(raw);
  return Object.freeze({
    NODE_ENV: raw.NODE_ENV,
    PORT: raw.PORT,
    CLIENT_URL: raw.CLIENT_URL,
    PUBLIC_URL: raw.PUBLIC_URL,
    DATABASE_URL: raw.DATABASE_URL,
    DATABASE_SSL: raw.DATABASE_SSL,
    DATABASE_SSL_CA: raw.DATABASE_SSL_CA ? fromServerRoot(raw.DATABASE_SSL_CA) : undefined,
    DATABASE_SCHEMA: raw.DATABASE_SCHEMA,
    SQLITE_DB_PATH: raw.SQLITE_DB_PATH ? fromServerRoot(raw.SQLITE_DB_PATH) : defaultDbPath(raw.NODE_ENV),
    CERT_STORAGE_DIR: fromServerRoot(raw.CERT_STORAGE_DIR ?? path.join('storage', 'certificates')),
    ...secrets,
    CERT_SIGNING_PRIVATE_KEY: raw.CERT_SIGNING_PRIVATE_KEY,
    CERT_SIGNING_KEY_DIR: fromServerRoot(raw.CERT_SIGNING_KEY_DIR ?? path.join('storage', 'keys'))
  });
}

/** Process-wide configuration, validated once at boot (fails fast on bad config). */
export const env: Env = loadEnv(process.env);
