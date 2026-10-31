import fs from 'fs';
import path from 'path';
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/index.js';
import { db } from '../src/db/index.js';
import { env } from '../src/config/env.js';
import { seedDatabase } from '../src/db/seed.js';
import { CertificateService } from '../src/services/certificateService.js';

const payload = {
  userId: 'user-campus-admin', email: 'admin@university.edu', role: 'ADMIN', fullName: 'System Administrator'
};

describe('auth token hardening', () => {
  it('rejects a token signed with the old hardcoded literal secret (401)', async () => {
    const forged = jwt.sign(payload, 'campusconnect-jwt-secret-key-2026', { expiresIn: '15m' });
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${forged}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('TOKEN_INVALID');
  });

  it('returns 401 TOKEN_EXPIRED for an expired token so the client can refresh', async () => {
    const expired = jwt.sign({ ...payload, exp: Math.floor(Date.now() / 1000) - 60 }, env.JWT_SECRET);
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('TOKEN_EXPIRED');
  });

  it('rejects alg=none tokens', async () => {
    const unsigned = jwt.sign(payload, '', { algorithm: 'none' });
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${unsigned}`);
    expect(res.status).toBe(401);
  });

  it('rejects HS512 tokens even with the right secret (algorithm pinned to HS256)', async () => {
    const hs512 = jwt.sign(payload, env.JWT_SECRET, { algorithm: 'HS512' });
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${hs512}`);
    expect(res.status).toBe(401);
  });

  it('sets an X-Request-Id header on responses', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.headers['x-request-id']).toBeTruthy();
  });
});

describe('test isolation and storage', () => {
  it('uses a temp database and certificate dir, never the dev ones', () => {
    expect(env.NODE_ENV).toBe('test');
    expect(env.SQLITE_DB_PATH).not.toMatch(/campusconnect\.db$/);
    expect(env.CERT_STORAGE_DIR).not.toContain(path.join('server', 'storage'));
  });

  it('writes certificate PDFs into CERT_STORAGE_DIR', async () => {
    const serialNumber = CertificateService.generateSerialNumber();
    const { filePath } = await CertificateService.generateCertificatePdf({
      studentName: 'Test Student', studentIdNumber: '0000', eventTitle: 'Test', clubName: 'Club',
      issueDate: '1 Nov 2026', serialNumber
    }, 'http://localhost:5173');
    expect(filePath).toBe(`/storage/certificates/${serialNumber}.pdf`);
    expect(fs.existsSync(path.join(env.CERT_STORAGE_DIR, `${serialNumber}.pdf`))).toBe(true);
  });
});

describe('demo seed', () => {
  beforeAll(async () => {
    await seedDatabase();
  });

  it('is idempotent and keeps registered_count consistent', async () => {
    await seedDatabase();
    const users = await db.queryOne<{ n: number }>("SELECT COUNT(*) AS n FROM users WHERE id = 'user-fahim-0432320005101007'");
    expect(users?.n).toBe(1);
    const ws = await db.queryOne<{ registered_count: number }>("SELECT registered_count FROM events WHERE id = 'event-ai-web-workshop'");
    expect(ws?.registered_count).toBe(2);
    const att = await db.queryOne<{ n: number }>("SELECT COUNT(*) AS n FROM attendance_records WHERE id = 'att-1'");
    expect(att?.n).toBe(1);
  });

  it('schedules upcoming events relative to now with ISO UTC timestamps', async () => {
    const ev = await db.queryOne<{ start_time: string; registration_deadline: string }>(
      "SELECT start_time, registration_deadline FROM events WHERE id = 'event-robotics-hackathon'"
    );
    expect(ev?.start_time).toMatch(/Z$/);
    expect(Date.parse(ev!.start_time)).toBeGreaterThan(Date.now());
    expect(Date.parse(ev!.registration_deadline)).toBeGreaterThan(Date.now());
  });

  it('includes department-paired UITS demo clubs labelled as demo', async () => {
    const clubs = await db.query<{ name: string; description: string }>('SELECT name, description FROM clubs');
    const names = clubs.map((c) => c.name);
    expect(names).toEqual(expect.arrayContaining(['Computer Club', 'IT Club', 'EEE Club', 'Business Club', 'English Club', 'Law Club', 'Cultural Club']));
    expect(clubs.every((c) => c.description.startsWith('[Demo]'))).toBe(true);
  });

  it('stores bound ISO timestamps for audit logs', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'fahim@university.edu', password: 'Password123!' });
    expect(res.status).toBe(200);
    const log = await db.queryOne<{ timestamp: string }>(
      "SELECT timestamp FROM audit_logs WHERE action = 'USER_LOGIN' ORDER BY timestamp DESC LIMIT 1"
    );
    expect(log?.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });
});
