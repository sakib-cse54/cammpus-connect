/**
 * Tamper-evident digital signatures for certificates: compact JWS with
 * EdDSA (Ed25519) via node:crypto. This proves the credential was issued by
 * this CampusConnect deployment and was not altered; it is not a legal
 * (qualified) electronic signature.
 */
import crypto, { KeyObject } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { env } from '../config/env.js';

export const CREDENTIAL_ISSUER = 'CampusConnect UITS';
/** JWS header `cty` binding each signed document to one credential type. */
export const CERTIFICATE_CTY = 'CC-CERTIFICATE';
export const TRANSCRIPT_CTY = 'CC-OBE-TRANSCRIPT';
const DEV_KEY_FILE = 'dev-ed25519.pem';

export interface CredentialPayload {
  readonly iss: string;
  readonly sub: string | null;
  readonly name: string;
  readonly event: string;
  readonly club: string;
  readonly event_date: string;
  readonly issued_at: string;
  readonly serial: string;
  readonly po: readonly string[];
  readonly sha256: string;
}

export interface Ed25519Jwk {
  readonly kty: 'OKP';
  readonly crv: 'Ed25519';
  readonly x: string;
  readonly kid: string;
  readonly alg: 'EdDSA';
  readonly use: 'sig';
}

interface KeyPair {
  readonly privateKey: KeyObject;
  readonly publicKey: KeyObject;
  readonly kid: string;
}

export type JwsFailureReason = 'MALFORMED' | 'UNSUPPORTED_ALG' | 'UNKNOWN_KID' | 'BAD_SIGNATURE' | 'WRONG_TYPE';

export type JwsVerification =
  | { readonly ok: true; readonly payload: CredentialPayload; readonly kid: string }
  | { readonly ok: false; readonly reason: JwsFailureReason };

let cached: KeyPair | undefined;

const b64u = (buf: Buffer | string): string => Buffer.from(buf).toString('base64url');

function loadOrCreateDevKey(): KeyObject {
  const file = path.join(env.CERT_SIGNING_KEY_DIR, DEV_KEY_FILE);
  if (fs.existsSync(file)) return crypto.createPrivateKey(fs.readFileSync(file, 'utf8'));
  fs.mkdirSync(env.CERT_SIGNING_KEY_DIR, { recursive: true, mode: 0o700 });
  const { privateKey } = crypto.generateKeyPairSync('ed25519');
  try {
    fs.writeFileSync(file, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600, flag: 'wx' });
  } catch (err) {
    // Another process created it first: use theirs so every process shares one kid.
    if ((err as NodeJS.ErrnoException).code === 'EEXIST') return crypto.createPrivateKey(fs.readFileSync(file, 'utf8'));
    throw err;
  }
  if (env.NODE_ENV !== 'test') {
    console.warn(`[signing] CERT_SIGNING_PRIVATE_KEY not set: generated a development Ed25519 key at ${file}. Do not use in production.`);
  }
  return privateKey;
}

function loadPrivateKey(): KeyObject {
  const pem = env.CERT_SIGNING_PRIVATE_KEY;
  if (pem) return crypto.createPrivateKey(pem.replace(/\\n/g, '\n'));
  if (env.NODE_ENV === 'production') {
    throw new Error('CERT_SIGNING_PRIVATE_KEY must be set in production');
  }
  return loadOrCreateDevKey();
}

/** Key id: first 16 hex chars of sha256 over the SPKI DER public key. */
export function computeKid(publicKey: KeyObject): string {
  const der = publicKey.export({ type: 'spki', format: 'der' });
  return crypto.createHash('sha256').update(der).digest('hex').slice(0, 16);
}

function getKeyPair(): KeyPair {
  if (cached) return cached;
  const privateKey = loadPrivateKey();
  if (privateKey.asymmetricKeyType !== 'ed25519') throw new Error('Certificate signing key must be Ed25519');
  const publicKey = crypto.createPublicKey(privateKey);
  cached = { privateKey, publicKey, kid: computeKid(publicKey) };
  return cached;
}

/** Fixed key order so the same credential always serialises identically. */
export function canonicalPayload(p: CredentialPayload): CredentialPayload {
  return {
    iss: p.iss, sub: p.sub, name: p.name, event: p.event, club: p.club, event_date: p.event_date,
    issued_at: p.issued_at, serial: p.serial, po: [...p.po], sha256: p.sha256
  };
}

/** Signs any JSON object as a compact EdDSA JWS whose header carries `cty` (callers fix the key order). */
export function signJson(payload: Readonly<Record<string, unknown>>, cty: string): string {
  const { privateKey, kid } = getKeyPair();
  const header = b64u(JSON.stringify({ alg: 'EdDSA', typ: 'JWT', cty, kid }));
  const body = b64u(JSON.stringify(payload));
  const signature = crypto.sign(null, Buffer.from(`${header}.${body}`), privateKey);
  return `${header}.${body}.${b64u(signature)}`;
}

export function signCredential(payload: CredentialPayload): string {
  return signJson({ ...canonicalPayload(payload) }, CERTIFICATE_CTY);
}

function parseJson(segment: string): unknown {
  try {
    return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
  } catch {
    return undefined;
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

type RawVerification =
  | { readonly ok: true; readonly header: Record<string, unknown>; readonly payload: Record<string, unknown>; readonly kid: string }
  | { readonly ok: false; readonly reason: JwsFailureReason };

/** Structure, alg, kid and Ed25519 signature only; no type binding. */
function verifySignature(jws: string): RawVerification {
  const parts = jws.split('.');
  if (parts.length !== 3 || parts.some((p) => !/^[A-Za-z0-9_-]+$/.test(p))) return { ok: false, reason: 'MALFORMED' };
  const header = parseJson(parts[0]);
  const payload = parseJson(parts[1]);
  if (!isRecord(header) || !isRecord(payload)) return { ok: false, reason: 'MALFORMED' };
  if (header.alg !== 'EdDSA') return { ok: false, reason: 'UNSUPPORTED_ALG' };
  const { publicKey, kid } = getKeyPair();
  if (header.kid !== kid) return { ok: false, reason: 'UNKNOWN_KID' };
  const valid = crypto.verify(null, Buffer.from(`${parts[0]}.${parts[1]}`), publicKey, Buffer.from(parts[2], 'base64url'));
  if (!valid) return { ok: false, reason: 'BAD_SIGNATURE' };
  return { ok: true, header, payload, kid };
}

export type JsonJwsVerification =
  | { readonly ok: true; readonly payload: Readonly<Record<string, unknown>>; readonly kid: string }
  | { readonly ok: false; readonly reason: JwsFailureReason };

/**
 * Verifies a JWS signed by signJson and requires both the header `cty` and the
 * payload `typ` to equal `expectedTyp`, so one credential type cannot pass as another.
 */
export function verifyJson(jws: string, expectedTyp: string): JsonJwsVerification {
  const r = verifySignature(jws);
  if (!r.ok) return r;
  if (r.header.cty !== expectedTyp || r.payload.typ !== expectedTyp) return { ok: false, reason: 'WRONG_TYPE' };
  return { ok: true, payload: r.payload, kid: r.kid };
}

/**
 * Verifies a certificate credential. Requires header cty CC-CERTIFICATE (a
 * missing cty is accepted for certificates signed before type binding, as
 * long as the payload carries no `typ`), and a string `serial`.
 * Revocation is checked by the caller.
 */
export function verifyCredential(jws: string): JwsVerification {
  const r = verifySignature(jws);
  if (!r.ok) return r;
  const legacy = r.header.cty === undefined && r.payload.typ === undefined;
  if (r.header.cty !== CERTIFICATE_CTY && !legacy) return { ok: false, reason: 'WRONG_TYPE' };
  if (r.payload.typ !== undefined) return { ok: false, reason: 'WRONG_TYPE' };
  if (typeof r.payload.serial !== 'string' || r.payload.serial.length === 0) return { ok: false, reason: 'MALFORMED' };
  return { ok: true, payload: r.payload as unknown as CredentialPayload, kid: r.kid };
}

export function getPublicJwk(): Ed25519Jwk {
  const { publicKey, kid } = getKeyPair();
  const jwk = publicKey.export({ format: 'jwk' });
  if (typeof jwk.x !== 'string') throw new Error('Unable to export Ed25519 public key');
  return { kty: 'OKP', crv: 'Ed25519', x: jwk.x, kid, alg: 'EdDSA', use: 'sig' };
}

export function getJwks(): { keys: Ed25519Jwk[] } {
  return { keys: [getPublicJwk()] };
}
