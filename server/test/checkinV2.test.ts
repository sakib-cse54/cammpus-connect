import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { db } from '../src/db/index.js';
import { QrService } from '../src/services/qrService.js';
import { seedDatabase } from '../src/db/seed.js';
import { IDS } from '../src/db/demoData.js';
import { bearer, DemoName } from './helpers.js';

const ev = IDS.workshop; // live, at [Demo] Seminar Room (23.8014, 90.4281, r=30 m)
const scanUrl = `/api/v1/events/${ev}/attendance/scan`;
const DEVICE = '3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b';

async function confirm(name: DemoName, ticket: string): Promise<void> {
  await db.execute(
    `INSERT INTO registrations (id, event_id, user_id, ticket_code, status, waitlist_position, created_at)
     VALUES ($1, $2, $3, $4, 'CONFIRMED', NULL, $5)
     ON CONFLICT (event_id, user_id) DO UPDATE SET status = 'CONFIRMED', ticket_code = excluded.ticket_code`,
    [`reg-v2-${name}`, ev, IDS[name], ticket, new Date().toISOString()]);
}

describe('check-in v2: deep link, short code, slot tolerance', () => {
  beforeAll(async () => { await seedDatabase(); });

  it('live-qr returns a deep link, token and 6-digit short code', async () => {
    const res = await request(app).get(`/api/v1/events/${ev}/attendance/live-qr`).set(...bearer('fahim'));
    expect(res.status).toBe(200);
    expect(res.body.checkin_url).toMatch(new RegExp(`/checkin/${ev}\\?t=`));
    expect(decodeURIComponent(res.body.checkin_url.split('?t=')[1])).toBe(res.body.token);
    expect(res.body.short_code).toMatch(/^\d{6}$/);
  });

  it('accepts current and previous slot only', () => {
    const s = QrService.getCurrentSlot();
    expect(QrService.verifyDynamicToken(QrService.generateDynamicToken(ev, s - 1), ev)).toBe(true);
    expect(QrService.verifyDynamicToken(QrService.generateDynamicToken(ev, s - 2), ev)).toBe(false);
    expect(QrService.verifyDynamicToken(QrService.generateDynamicToken(ev, s + 1), ev)).toBe(false);
    expect(QrService.verifyShortCode(QrService.generateShortCode(ev, s - 1), ev)).toBe(true);
    expect(QrService.verifyShortCode(QrService.generateShortCode(ev, s - 3), ev)).toBe(false);
    expect(QrService.verifyShortCode(QrService.generateShortCode('other-event', s), ev)).toBe(false);
  });

  it('rejects a body with both or neither credential (400)', async () => {
    const both = await request(app).post(scanUrl).set(...bearer('nusrat'))
      .send({ token: QrService.generateDynamicToken(ev), short_code: '123456' });
    expect(both.status).toBe(400);
    const none = await request(app).post(scanUrl).set(...bearer('nusrat')).send({});
    expect(none.status).toBe(400);
  });

  it('rejects a malformed X-Device-Id (400)', async () => {
    const res = await request(app).post(scanUrl).set(...bearer('nusrat')).set('X-Device-Id', 'not-a-uuid')
      .send({ short_code: QrService.generateShortCode(ev) });
    expect(res.status).toBe(400);
  });

  it('checks in via short code inside the geofence without flags', async () => {
    await confirm('nusrat', 'TCK-V2-NUSRAT');
    const res = await request(app).post(scanUrl).set(...bearer('nusrat')).set('X-Device-Id', DEVICE)
      .send({ short_code: QrService.generateShortCode(ev), lat: 23.8014, lng: 90.4281, accuracy: 15 });
    expect(res.status).toBe(201);
    expect(res.body.flags).toEqual([]);
    expect(res.body.distance_m).toBe(0);
  });

  it('flags OUT_OF_RANGE and SHARED_DEVICE but still records attendance', async () => {
    await confirm('sadia', 'TCK-V2-SADIA');
    const res = await request(app).post(scanUrl).set(...bearer('sadia')).set('X-Device-Id', DEVICE.toUpperCase())
      .send({ token: QrService.generateDynamicToken(ev), lat: 23.8100, lng: 90.4281, accuracy: 500 });
    expect(res.status).toBe(201);
    expect(res.body.flags).toEqual(['OUT_OF_RANGE', 'SHARED_DEVICE']);
    expect(res.body.distance_m).toBeGreaterThan(900);
  });

  it('GET attendance returns parsed flags and distance', async () => {
    const res = await request(app).get(`/api/v1/events/${ev}/attendance`).set(...bearer('fahim'));
    expect(res.status).toBe(200);
    const sadia = res.body.attendees.find((a: { full_name: string }) => /sadia/i.test(a.full_name));
    expect(sadia.flags).toEqual(['OUT_OF_RANGE', 'SHARED_DEVICE']);
    expect(sadia.distance_m).toBeGreaterThan(900);
    expect(res.body.flagged_count).toBeGreaterThanOrEqual(1);
  });
});

describe('check-in v2: organizer offline batch', () => {
  const batchUrl = `/api/v1/events/${ev}/attendance/batch`;

  it('forbids non-organizers (403) and validates the body (400)', async () => {
    const item = { ticket_code: 'X', scanned_at: new Date().toISOString(), idempotency_key: 'k' };
    expect((await request(app).post(batchUrl).set(...bearer('ayesha')).send([item])).status).toBe(403);
    expect((await request(app).post(batchUrl).set(...bearer('fahim')).send([])).status).toBe(400);
    expect((await request(app).post(batchUrl).set(...bearer('fahim'))
      .send([{ ...item, scanned_at: '2026-01-01 10:00' }])).status).toBe(400);
  });

  it('returns per-item results and dedupes by registration', async () => {
    await confirm('tanvir', 'TCK-V2-TANVIR');
    const now = new Date().toISOString();
    const res = await request(app).post(batchUrl).set(...bearer('fahim')).send({ items: [
      { ticket_code: 'TCK-V2-TANVIR', scanned_at: now, idempotency_key: 'a1' },
      { ticket_code: 'TCK-V2-TANVIR', scanned_at: now, idempotency_key: 'a2' },
      { ticket_code: 'TCK-NOPE', scanned_at: now, idempotency_key: 'a3' },
      { ticket_code: 'TCK-V2-TANVIR', scanned_at: '2020-01-01T00:00:00+06:00', idempotency_key: 'a4' }
    ] });
    expect(res.status).toBe(200);
    expect(res.body.results.map((r: { status: string }) => r.status))
      .toEqual(['CHECKED_IN', 'DUPLICATE', 'NOT_FOUND', 'OUT_OF_WINDOW']);
    expect(res.body.results[1].attendance_id).toBe(res.body.results[0].attendance_id);
    expect(res.body.checked_in).toBe(1);
    const replay = await request(app).post(batchUrl).set(...bearer('fahim'))
      .send([{ ticket_code: 'TCK-V2-TANVIR', scanned_at: now, idempotency_key: 'a1' }]);
    expect(replay.body.results[0].status).toBe('DUPLICATE');
    const rec = await db.queryOne<{ method: string; recorded_by: string }>(
      'SELECT method, recorded_by FROM attendance_records WHERE id = $1', [res.body.results[0].attendance_id]);
    expect(rec).toEqual({ method: 'OFFLINE_BATCH', recorded_by: IDS.fahim });
  });
});
