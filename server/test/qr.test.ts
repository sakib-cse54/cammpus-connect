import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { db } from '../src/db/index.js';
import { QrService } from '../src/services/qrService.js';
import { seedDatabase } from '../src/db/seed.js';
import { IDS } from '../src/db/demoData.js';
import { bearer } from './helpers.js';

const liveEvent = IDS.workshop;
const futureEvent = IDS.hackathon;

describe('Anti-Proxy Dynamic Rotating QR Engine', () => {
  beforeAll(async () => {
    await seedDatabase();
  });

  it('generates a dynamic QR pass for an executive of the hosting club', async () => {
    const res = await request(app).get(`/api/v1/events/${liveEvent}/attendance/live-qr`).set(...bearer('fahim'));
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.qr_data_url).toContain('data:image/png;base64');
    expect(res.body.rotation_interval_seconds).toBe(20);
    expect(res.body.expires_in_seconds).toBeGreaterThan(0);
  });

  it('forbids live-qr to an executive of another club (403)', async () => {
    const res = await request(app).get(`/api/v1/events/${liveEvent}/attendance/live-qr`).set(...bearer('tanvir'));
    expect(res.status).toBe(403);
  });

  it('verifies live tokens and rejects tokens older than 40s', () => {
    const slot = QrService.getCurrentSlot();
    expect(QrService.verifyDynamicToken(QrService.generateDynamicToken(liveEvent, slot), liveEvent)).toBe(true);
    expect(QrService.verifyDynamicToken(QrService.generateDynamicToken(liveEvent, slot - 3), liveEvent)).toBe(false);
  });

  it('rejects expired tokens with 400', async () => {
    const expired = QrService.generateDynamicToken(liveEvent, QrService.getCurrentSlot() - 5);
    const res = await request(app).post(`/api/v1/events/${liveEvent}/attendance/scan`).set(...bearer('ayesha')).send({ token: expired });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('QR token expired');
  });

  it('ignores body student_id: the scanner checks in only themselves', async () => {
    const res = await request(app)
      .post(`/api/v1/events/${liveEvent}/attendance/scan`)
      .set(...bearer('ayesha'))
      .send({ token: QrService.generateDynamicToken(liveEvent), student_id: IDS.nusrat });
    expect(res.status).toBe(201);
    const rec = await db.queryOne<{ user_id: string; recorded_by: string }>(
      'SELECT user_id, recorded_by FROM attendance_records WHERE id = $1', [res.body.attendance_id]);
    expect(rec).toEqual({ user_id: IDS.ayesha, recorded_by: IDS.ayesha });
  });

  it('returns 409 (not 500) on a duplicate scan', async () => {
    const res = await request(app)
      .post(`/api/v1/events/${liveEvent}/attendance/scan`)
      .set(...bearer('ayesha'))
      .send({ token: QrService.generateDynamicToken(liveEvent) });
    expect(res.status).toBe(409);
  });

  it('rejects WAITLISTED or CANCELLED registrations with 403', async () => {
    await db.execute(
      `INSERT INTO registrations (id, event_id, user_id, ticket_code, status, waitlist_position, created_at)
       VALUES ('reg-qr-wait', $1, $2, 'TCK-QR-WAIT', 'WAITLISTED', 1, $3)
       ON CONFLICT (event_id, user_id) DO UPDATE SET status = 'WAITLISTED'`,
      [liveEvent, IDS.nusrat, new Date().toISOString()]
    );
    const token = QrService.generateDynamicToken(liveEvent);
    const waitlisted = await request(app).post(`/api/v1/events/${liveEvent}/attendance/scan`).set(...bearer('nusrat')).send({ token });
    expect(waitlisted.status).toBe(403);
    await db.execute(`UPDATE registrations SET status = 'CANCELLED' WHERE id = 'reg-qr-wait'`);
    const cancelled = await request(app).post(`/api/v1/events/${liveEvent}/attendance/scan`).set(...bearer('nusrat')).send({ token });
    expect(cancelled.status).toBe(403);
  });

  it('rejects scans outside the event window with 400', async () => {
    const res = await request(app)
      .post(`/api/v1/events/${futureEvent}/attendance/scan`)
      .set(...bearer('fahim'))
      .send({ token: QrService.generateDynamicToken(futureEvent) });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Check-in is only open');
  });

  it('requires a reason for manual check-in', async () => {
    const res = await request(app)
      .post(`/api/v1/events/${liveEvent}/attendance/manual`)
      .set(...bearer('fahim'))
      .send({ student_id_number: '0432320005101099' });
    expect(res.status).toBe(400);
    expect(res.body.issues.some((i: { path: string }) => i.path === 'reason')).toBe(true);
  });

  it('rejects malformed tokens without crashing', async () => {
    const slot = QrService.getCurrentSlot();
    expect(QrService.verifyDynamicToken('invalid-token', liveEvent)).toBe(false);
    expect(QrService.verifyDynamicToken(`${slot}:short`, liveEvent)).toBe(false);
    expect(QrService.verifyDynamicToken(`${slot}:${'a'.repeat(64)}`, liveEvent)).toBe(false);
    const res = await request(app).post(`/api/v1/events/${liveEvent}/attendance/scan`).set(...bearer('ayesha')).send({ token: `${slot}:short` });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('QR token expired or invalid');
  });
});
