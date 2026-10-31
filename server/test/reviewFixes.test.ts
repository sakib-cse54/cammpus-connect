/** Regression tests for the v3 review findings (signing type binding, leaks, auth, timestamps, lifecycle). */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import Database from 'better-sqlite3';
import { app } from '../src/index.js';
import { db } from '../src/db/index.js';
import { seedDatabase } from '../src/db/seed.js';
import { IDS } from '../src/db/demoData.js';
import { VENUE_IDS } from '../src/db/demoCalendar.js';
import { env } from '../src/config/env.js';
import { loadMigrations, resolveMigrationsDir, runSqliteMigrations } from '../src/db/migrate.js';
import {
  CredentialPayload, CERTIFICATE_CTY, TRANSCRIPT_CTY, signCredential, signJson, verifyCredential, verifyJson
} from '../src/services/signingService.js';
import { poReportQuerySchema } from '../src/validation/outcomeSchemas.js';
import { STALE_PENDING_MS } from '../src/controllers/certificateController.js';
import { dhakaWallTime, addMinutes, nowIso } from '../src/utils/time.js';
import { bearer } from './helpers.js';

const API = '/api/v1';
const sample: CredentialPayload = {
  iss: 'CampusConnect UITS', sub: '****5101', name: 'Test', event: 'E', club: 'C',
  event_date: '2026-10-01', issued_at: '2026-10-02T00:00:00.000Z', serial: 'CC-2026-X', po: [], sha256: 'ab'.repeat(32)
};

beforeAll(async () => {
  await seedDatabase();
});

describe('JWS type binding', () => {
  const transcript = { typ: TRANSCRIPT_CTY, iss: 'CampusConnect UITS', tid: 'TR-X' };

  it('rejects a transcript JWS as a certificate credential', async () => {
    const jws = signJson(transcript, TRANSCRIPT_CTY);
    expect(verifyCredential(jws)).toEqual({ ok: false, reason: 'WRONG_TYPE' });
    const res = await request(app).post(`${API}/certificates/verify-jws`).send({ jws });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ valid: false, signature_valid: false, reason: 'WRONG_TYPE' });
  });

  it('rejects a certificate JWS as a transcript', () => {
    expect(verifyJson(signCredential(sample), TRANSCRIPT_CTY)).toEqual({ ok: false, reason: 'WRONG_TYPE' });
    expect(verifyJson(signJson(transcript, TRANSCRIPT_CTY), TRANSCRIPT_CTY).ok).toBe(true);
  });

  it('accepts legacy certificates without cty but requires a string serial', () => {
    const legacy = signJson({ ...sample }, undefined as unknown as string);
    expect(verifyCredential(legacy).ok).toBe(true);
    const { serial: _drop, ...noSerial } = sample;
    expect(verifyCredential(signJson(noSerial, CERTIFICATE_CTY))).toEqual({ ok: false, reason: 'MALFORMED' });
  });
});

describe('POST /schedule/check visibility', () => {
  const start = dhakaWallTime(new Date(), 20, 10).toISOString();
  const end = addMinutes(start, 120).toISOString();

  beforeAll(async () => {
    await db.execute(
      `INSERT INTO events (id, club_id, title, description, venue, venue_id, start_time, end_time, capacity, registration_deadline, status, created_by)
       VALUES ('ev-secret', $1, 'Secret Pending Gala', 'x', 'v', $2, $3, $4, 10, $3, 'PENDING_APPROVAL', $5)`,
      [IDS.culturalClub, VENUE_IDS.auditorium, start, end, IDS.admin]);
  });

  const check = (who: 'tanvir' | 'admin') => request(app).post(`${API}/schedule/check`).set(...bearer(who))
    .send({ start, end, venue_id: VENUE_IDS.auditorium });

  it('hides id and title of another club unpublished event', async () => {
    const res = await check('tanvir');
    const conflict = res.body.errors.find((i: { code: string }) => i.code === 'VENUE_CONFLICT');
    expect(conflict.ref).toBeUndefined();
    expect(conflict.window).toEqual({ starts_at: start, ends_at: end });
    expect(JSON.stringify(res.body)).not.toContain('Secret Pending Gala');
  });

  it('shows details to an admin', async () => {
    const res = await check('admin');
    const conflict = res.body.errors.find((i: { code: string }) => i.code === 'VENUE_CONFLICT');
    expect(conflict.ref).toMatchObject({ id: 'ev-secret', title: 'Secret Pending Gala' });
  });
});

describe('auth refresh and 500 hygiene', () => {
  const refreshFor = (userId: string, tv?: number): string =>
    jwt.sign(tv === undefined ? { userId } : { userId, tv }, env.JWT_REFRESH_SECRET, { algorithm: 'HS256', expiresIn: '7d' });
  const refresh = (token: string) => request(app).post(`${API}/auth/refresh`).send({ refresh_token: token });

  it('rejects tokens without a token version and accepts the current one', async () => {
    expect((await refresh(refreshFor(IDS.rahim))).status).toBe(403);
    expect((await refresh('garbage')).status).toBe(403);
    const ok = await refresh(refreshFor(IDS.rahim, 0));
    expect(ok.status).toBe(200);
    expect(ok.body.user).toMatchObject({ userId: IDS.rahim, role: 'STUDENT' });
  });

  it('logout revokes outstanding refresh tokens', async () => {
    const token = refreshFor(IDS.ayesha, 0);
    expect((await request(app).post(`${API}/auth/logout`).send({ refresh_token: token })).status).toBe(200);
    const res = await refresh(token);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('TOKEN_REVOKED');
  });

  it('a role change revokes refresh tokens', async () => {
    const token = refreshFor(IDS.nusrat, 0);
    const upd = await request(app).patch(`${API}/auth/users/${IDS.nusrat}/role`).set(...bearer('admin')).send({ role: 'CLUB_EXECUTIVE' });
    expect(upd.status).toBe(200);
    expect((await refresh(token)).status).toBe(403);
    expect((await request(app).patch(`${API}/auth/users/${IDS.nusrat}/role`).set(...bearer('admin')).send({ role: 'GOD' })).status).toBe(400);
  });

  it('a DB failure in refresh reaches errorHandler instead of hanging', async () => {
    const spy = vi.spyOn(db, 'queryOne').mockRejectedValueOnce(new Error('SQLITE_BUSY: secret schema text'));
    const res = await refresh(refreshFor(IDS.rahim, 0));
    spy.mockRestore();
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('SQLITE_BUSY');
  });

  it('getAllUsers and analytics 500s do not leak err.message', async () => {
    const spy = vi.spyOn(db, 'query').mockRejectedValue(new Error('no such column: secret_col'));
    const users = await request(app).get(`${API}/auth/users`).set(...bearer('admin'));
    const analytics = await request(app).get(`${API}/analytics/admin`).set(...bearer('admin'));
    spy.mockRestore();
    for (const r of [users, analytics]) {
      expect(r.status).toBe(500);
      expect(r.body.error).toBe('Internal Server Error');
      expect(r.body.details).toBeUndefined();
      expect(JSON.stringify(r.body)).not.toContain('secret_col');
    }
  });
});

describe('PO report filters', () => {
  it('normalizes offset datetimes to UTC ISO', () => {
    const q = poReportQuerySchema.parse({ from: '2026-10-01T00:00:00+06:00', to: '2026-10-02T00:00:00+06:00' });
    expect(q.from).toBe('2026-09-30T18:00:00.000Z');
    expect(q.to).toBe('2026-10-01T18:00:00.000Z');
  });
});

describe('certificate PENDING claims', () => {
  const eventId = 'event-demo-cse-contest-past';
  const insertPending = (issuedAt: string): Promise<unknown> => db.execute(
    `INSERT INTO certificates (id, serial_number, event_id, user_id, pdf_url, sha256_hash, status, issued_at)
     VALUES ('cert-stuck', 'CC-2026-STUCK', $1, $2, '/x.pdf', '', 'PENDING', $3)`, [eventId, IDS.ayesha, issuedAt]);
  const issue = () => request(app).post(`${API}/events/${eventId}/certificates/issue`).set(...bearer('ayesha')).send({});

  it('returns 409 while a fresh claim is in progress', async () => {
    await insertPending(nowIso());
    const res = await issue();
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CERTIFICATE_PENDING');
  });

  it('re-claims a stale PENDING row and issues the certificate', async () => {
    const old = new Date(Date.now() - STALE_PENDING_MS - 60_000).toISOString();
    await db.execute('UPDATE certificates SET issued_at = $1 WHERE id = $2', [old, 'cert-stuck']);
    const res = await issue();
    expect(res.status).toBe(201);
    expect(res.body.certificate).toMatchObject({ id: 'cert-stuck', status: 'VALID' });
  });
});

describe('cancel after start', () => {
  it('refuses to cancel a PUBLISHED event that has started', async () => {
    const start = addMinutes(nowIso(), -60).toISOString();
    await db.execute(
      `INSERT INTO events (id, club_id, title, description, venue, start_time, end_time, capacity, registration_deadline, status, created_by)
       VALUES ('ev-started', $1, 'Started', 'x', 'v', $2, $3, 10, $2, 'PUBLISHED', $4)`,
      [IDS.computerClub, start, addMinutes(start, 180).toISOString(), IDS.fahim]);
    const res = await request(app).post(`${API}/events/ev-started/cancel`).set(...bearer('fahim')).send({ reason: 'Too late now' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('EVENT_ALREADY_STARTED');
  });
});

describe('migration 008 timestamp normalization', () => {
  it('rewrites legacy naive timestamps to UTC ISO', () => {
    const all = loadMigrations(resolveMigrationsDir());
    const sqlite = new Database(':memory:');
    runSqliteMigrations(sqlite, all.filter((m) => m.version < '008'));
    sqlite.exec(`
      INSERT INTO users (id, email, password_hash, role, status, created_at) VALUES ('u1', 'a@b.c', 'x', 'STUDENT', 'ACTIVE', '2026-10-30 12:46:02');
      INSERT INTO clubs (id, name, slug, description, category, faculty_advisor_id) VALUES ('c1', 'C', 'c', 'd', 'x', 'u1');
      INSERT INTO events (id, club_id, title, description, venue, start_time, end_time, capacity, registration_deadline, status, created_by)
        VALUES ('e1', 'c1', 't', 'd', 'v', '2026-11-10 10:00:00', '2026-11-10T13:30', 5, '2026-11-09T23:59:59+06:00', 'PUBLISHED', 'u1'),
               ('e2', 'c1', 't', 'd', 'v', '2026-11-10T04:00:00.000Z', '2026-11-10T05:00:00.000Z', 5, '2026-11-09T17:59:59.000Z', 'PUBLISHED', 'u1');
      INSERT INTO registrations (id, event_id, user_id, ticket_code, created_at) VALUES ('r1', 'e1', 'u1', 'T1', '2026-10-30 12:46:02');
      INSERT INTO attendance_records (id, event_id, user_id, registration_id, check_in_time, method, recorded_by)
        VALUES ('a1', 'e1', 'u1', 'r1', '2026-10-30 12:46:02', 'QR', 'u1');
    `);
    runSqliteMigrations(sqlite, all);
    const ev = sqlite.prepare('SELECT start_time, end_time, registration_deadline FROM events ORDER BY id').all();
    expect(ev).toEqual([
      { start_time: '2026-11-10T04:00:00.000Z', end_time: '2026-11-10T07:30:00.000Z', registration_deadline: '2026-11-09T17:59:59.000Z' },
      { start_time: '2026-11-10T04:00:00.000Z', end_time: '2026-11-10T05:00:00.000Z', registration_deadline: '2026-11-09T17:59:59.000Z' }
    ]);
    expect(sqlite.prepare('SELECT check_in_time FROM attendance_records').get()).toEqual({ check_in_time: '2026-10-30T12:46:02.000Z' });
    expect(sqlite.prepare('SELECT created_at FROM registrations').get()).toEqual({ created_at: '2026-10-30T12:46:02.000Z' });
    expect(sqlite.prepare('SELECT token_version FROM users').get()).toEqual({ token_version: 0 });
    sqlite.close();
  });
});
