import { describe, it, expect, beforeAll } from 'vitest';
import crypto from 'node:crypto';
import request from 'supertest';
import { app } from '../src/index.js';
import { db } from '../src/db/index.js';
import { seedDatabase } from '../src/db/seed.js';
import { CredentialPayload, getPublicJwk, signCredential, verifyCredential } from '../src/services/signingService.js';
import { bearer } from './helpers.js';

const sample: CredentialPayload = {
  iss: 'CampusConnect UITS', sub: '************5101', name: 'Test Student', event: 'Contest', club: 'Computer Club',
  event_date: '2026-10-01', issued_at: '2026-10-02T00:00:00.000Z', serial: 'CC-2026-TEST', po: [], sha256: 'ab'.repeat(32)
};

function tamper(jws: string, mutate: (p: Record<string, unknown>) => Record<string, unknown>): string {
  const [h, p, s] = jws.split('.');
  const body = mutate(JSON.parse(Buffer.from(p, 'base64url').toString('utf8')) as Record<string, unknown>);
  return `${h}.${Buffer.from(JSON.stringify(body)).toString('base64url')}.${s}`;
}

describe('signingService (Ed25519 compact JWS)', () => {
  it('signs with an EdDSA header carrying the kid', () => {
    const jws = signCredential(sample);
    const header = JSON.parse(Buffer.from(jws.split('.')[0], 'base64url').toString('utf8'));
    expect(header).toEqual({ alg: 'EdDSA', typ: 'JWT', cty: 'CC-CERTIFICATE', kid: getPublicJwk().kid });
    expect(getPublicJwk().kid).toMatch(/^[0-9a-f]{16}$/);
    const r = verifyCredential(jws);
    expect(r.ok && r.payload).toEqual(sample);
  });

  it('verifies offline with only the published JWK', () => {
    const jws = signCredential(sample);
    const [h, p, s] = jws.split('.');
    const key = crypto.createPublicKey({ key: { ...getPublicJwk() }, format: 'jwk' });
    expect(crypto.verify(null, Buffer.from(`${h}.${p}`), key, Buffer.from(s, 'base64url'))).toBe(true);
  });

  it('rejects tampered payloads, alg swaps and malformed input', () => {
    const jws = signCredential(sample);
    expect(verifyCredential(tamper(jws, (b) => ({ ...b, name: 'Mallory' })))).toEqual({ ok: false, reason: 'BAD_SIGNATURE' });
    const [, p, s] = jws.split('.');
    const none = Buffer.from(JSON.stringify({ alg: 'none', kid: getPublicJwk().kid })).toString('base64url');
    expect(verifyCredential(`${none}.${p}.${s}`)).toEqual({ ok: false, reason: 'UNSUPPORTED_ALG' });
    const otherKid = Buffer.from(JSON.stringify({ alg: 'EdDSA', kid: '0000000000000000' })).toString('base64url');
    expect(verifyCredential(`${otherKid}.${p}.${s}`)).toEqual({ ok: false, reason: 'UNKNOWN_KID' });
    expect(verifyCredential('a.b')).toEqual({ ok: false, reason: 'MALFORMED' });
  });
});

describe('signed certificate endpoints', () => {
  let serial = '';
  let jws = '';

  beforeAll(async () => {
    await seedDatabase();
    const res = await request(app).post('/api/v1/events/event-demo-cse-contest-past/certificates/issue')
      .set(...bearer('ayesha')).send({});
    expect([200, 201]).toContain(res.status);
    serial = res.body.certificate.serial_number;
  });

  it('serves the JWKS at the app root and under /api/v1', async () => {
    const root = await request(app).get('/.well-known/jwks.json');
    const api = await request(app).get('/api/v1/.well-known/jwks.json');
    expect(root.status).toBe(200);
    expect(root.body).toEqual(api.body);
    expect(root.body.keys[0]).toMatchObject({ kty: 'OKP', crv: 'Ed25519', alg: 'EdDSA' });
    expect(root.body.keys[0].d).toBeUndefined();
  });

  it('returns the public credential with a masked subject and the PDF hash', async () => {
    const res = await request(app).get(`/api/v1/certificates/${serial}/credential`);
    expect(res.status).toBe(200);
    jws = res.body.jws;
    const cert = await db.queryOne<{ sha256_hash: string }>('SELECT sha256_hash FROM certificates WHERE serial_number = $1', [serial]);
    expect(res.body.payload).toMatchObject({ iss: 'CampusConnect UITS', serial, po: ['PO1', 'PO2', 'PO5'], sha256: cert?.sha256_hash });
    expect(res.body.payload.sub).toMatch(/^\*+\d{4}$/);
    expect(res.body.payload.event_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns 404 for an unknown serial', async () => {
    expect((await request(app).get('/api/v1/certificates/CC-0000-NOPE/credential')).status).toBe(404);
  });

  it('verify-jws accepts the genuine credential and rejects a tampered one', async () => {
    const ok = await request(app).post('/api/v1/certificates/verify-jws').send({ jws });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ valid: true, signature_valid: true, status: 'VALID' });
    const bad = await request(app).post('/api/v1/certificates/verify-jws')
      .send({ jws: tamper(jws, (b) => ({ ...b, event: 'Something Else' })) });
    expect(bad.body).toEqual({ valid: false, signature_valid: false, reason: 'BAD_SIGNATURE' });
    expect((await request(app).post('/api/v1/certificates/verify-jws').send({})).status).toBe(400);
  });

  it('verify-jws flags unknown serials and revoked certificates', async () => {
    const orphan = await request(app).post('/api/v1/certificates/verify-jws')
      .send({ jws: signCredential({ ...sample, serial: 'CC-2026-GHOST' }) });
    expect(orphan.body).toMatchObject({ valid: false, signature_valid: true, reason: 'UNKNOWN_SERIAL' });
    const rv = await request(app).post(`/api/v1/certificates/${serial}/revoke`).set(...bearer('admin')).send({ reason: 'Test revoke' });
    expect(rv.status).toBe(200);
    const revoked = await request(app).post('/api/v1/certificates/verify-jws').send({ jws });
    expect(revoked.body).toMatchObject({ valid: false, signature_valid: true, reason: 'REVOKED' });
    expect(revoked.body.revoked_at).toBeTruthy();
  });
});
