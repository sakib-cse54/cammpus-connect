import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { db } from '../src/db/index.js';
import { seedDatabase } from '../src/db/seed.js';
import { IDS } from '../src/db/demoData.js';
import { bearer } from './helpers.js';

const API = '/api/v1';
const pastEvent = 'event-demo-cse-contest-past';
let serial = '';

beforeAll(async () => {
  await seedDatabase();
  const res = await request(app).post(`${API}/events/${pastEvent}/certificates/issue`).set(...bearer('ayesha')).send({});
  serial = res.body.certificate.serial_number;
});

describe('certificate issuance rules', () => {
  it('returns the existing certificate on a repeat request', async () => {
    const res = await request(app).post(`${API}/events/${pastEvent}/certificates/issue`).set(...bearer('ayesha')).send({});
    expect(res.status).toBe(200);
    expect(res.body.certificate.serial_number).toBe(serial);
  });

  it('refuses before the event has ended', async () => {
    const res = await request(app).post(`${API}/events/${IDS.workshop}/certificates/issue`).set(...bearer('rahim')).send({});
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('after the event ends');
  });

  it('ignores body.user_id from a student', async () => {
    const res = await request(app).post(`${API}/events/${pastEvent}/certificates/issue`)
      .set(...bearer('rahim')).send({ user_id: IDS.ayesha });
    // Treated as Rahim's own request: he has no feedback, so 403 rather than Ayesha's certificate
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('feedback');
  });

  it('lets a club executive issue for an eligible attendee', async () => {
    await db.execute(
      `INSERT INTO feedback (id, event_id, user_id, rating, comments, is_anonymous, submitted_at)
       VALUES ('fb-rahim-past', $1, $2, 4, 'ok', 0, $3) ON CONFLICT (event_id, user_id) DO NOTHING`,
      [pastEvent, IDS.rahim, new Date().toISOString()]);
    const res = await request(app).post(`${API}/events/${pastEvent}/certificates/issue`)
      .set(...bearer('fahim')).send({ user_id: IDS.rahim });
    expect(res.status).toBe(201);
    const row = await db.queryOne<{ user_id: string }>('SELECT user_id FROM certificates WHERE serial_number = $1', [res.body.certificate.serial_number]);
    expect(row?.user_id).toBe(IDS.rahim);
  });
});

describe('certificate download', () => {
  it('requires authentication', async () => {
    expect((await request(app).get(`${API}/certificates/download/${serial}`)).status).toBe(401);
  });

  it('is denied to other students (403)', async () => {
    expect((await request(app).get(`${API}/certificates/download/${serial}`).set(...bearer('nusrat'))).status).toBe(403);
  });

  it('is allowed to the owner and the club executive', async () => {
    const owner = await request(app).get(`${API}/certificates/download/${serial}`).set(...bearer('ayesha'));
    expect(owner.status).toBe(200);
    expect(owner.headers['content-type']).toContain('application/pdf');
    expect((await request(app).get(`${API}/certificates/download/${serial}`).set(...bearer('fahim'))).status).toBe(200);
  });

  it('is not served from a public static path', async () => {
    expect((await request(app).get(`/storage/certificates/${serial}.pdf`)).status).toBe(404);
  });
});

describe('certificate verification and revocation', () => {
  it('masks the student id and omits the department', async () => {
    const res = await request(app).get(`${API}/certificates/verify/${serial}`);
    expect(res.body.student_id_number).toBe('************1099');
    expect(res.body).not.toHaveProperty('student_department');
  });

  it('only admin or the club advisor can revoke, with a reason', async () => {
    expect((await request(app).post(`${API}/certificates/${serial}/revoke`).set(...bearer('fahim')).send({ reason: 'Fraud' })).status).toBe(403);
    expect((await request(app).post(`${API}/certificates/${serial}/revoke`).set(...bearer('jobair')).send({})).status).toBe(400);
    const ok = await request(app).post(`${API}/certificates/${serial}/revoke`).set(...bearer('jobair')).send({ reason: 'Attendance fraud' });
    expect(ok.status).toBe(200);
    const row = await db.queryOne<{ status: string; revoked_reason: string; revoked_at: string }>(
      'SELECT status, revoked_reason, revoked_at FROM certificates WHERE serial_number = $1', [serial]);
    expect(row?.status).toBe('REVOKED');
    expect(row?.revoked_reason).toBe('Attendance fraud');
    expect(row?.revoked_at).toMatch(/Z$/);
    const verify = await request(app).get(`${API}/certificates/verify/${serial}`);
    expect(verify.body.valid).toBe(false);
    expect((await request(app).post(`${API}/certificates/${serial}/revoke`).set(...bearer('admin')).send({ reason: 'Again' })).status).toBe(409);
  });
});
