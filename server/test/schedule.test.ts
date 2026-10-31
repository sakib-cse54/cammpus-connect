import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { db } from '../src/db/index.js';
import { seedDatabase } from '../src/db/seed.js';
import { IDS } from '../src/db/demoData.js';
import { VENUE_IDS } from '../src/db/demoCalendar.js';
import { dhakaWallTime, addMinutes } from '../src/utils/time.js';
import { bearer } from './helpers.js';

const API = '/api/v1';
const at = (day: number, hour: number): string => dhakaWallTime(new Date(), day, hour).toISOString();
const plusHours = (iso: string, h: number): string => addMinutes(iso, h * 60).toISOString();

function draft(over: Record<string, unknown>): Record<string, unknown> {
  const start = (over.start_time as string | undefined) ?? at(9, 10);
  return {
    club_id: IDS.computerClub, title: 'Schedule Test Event', description: 'x', capacity: 50,
    start_time: start, end_time: plusHours(start, 2), registration_deadline: plusHours(start, -24), ...over
  };
}

beforeAll(async () => {
  await seedDatabase();
});

describe('venues and calendar', () => {
  it('lists active demo venues publicly', async () => {
    const res = await request(app).get(`${API}/venues`);
    expect(res.status).toBe(200);
    expect(res.body.venues.map((v: { id: string }) => v.id)).toEqual(expect.arrayContaining(Object.values(VENUE_IDS)));
  });

  it('returns semesters and blackouts for a window', async () => {
    const res = await request(app).get(`${API}/calendar`).query({ from: at(0, 0), to: at(120, 0) });
    expect(res.status).toBe(200);
    expect(res.body.semesters.length).toBeGreaterThan(0);
    const kinds = res.body.blackouts.map((b: { kind: string }) => b.kind);
    expect(kinds).toEqual(expect.arrayContaining(['MIDTERM', 'FINAL_EXAM']));
  });

  it('rejects a bad calendar window (400)', async () => {
    const res = await request(app).get(`${API}/calendar`).query({ from: 'yesterday' });
    expect(res.status).toBe(400);
    expect(res.body.issues[0].path).toBe('from');
  });
});

describe('POST /schedule/check', () => {
  it('requires auth and validates input', async () => {
    expect((await request(app).post(`${API}/schedule/check`).send({})).status).toBe(401);
    const bad = await request(app).post(`${API}/schedule/check`).set(...bearer('fahim')).send({ start: at(9, 12), end: at(9, 10) });
    expect(bad.status).toBe(400);
  });

  it('reports a midterm blackout as an error', async () => {
    const res = await request(app).post(`${API}/schedule/check`).set(...bearer('fahim')).send({ start: at(42, 10), end: at(42, 12) });
    expect(res.status).toBe(200);
    expect(res.body.errors.map((i: { code: string }) => i.code)).toContain('BLACKOUT_BLOCK');
  });

  it('reports a venue conflict with the seeded debate', async () => {
    const res = await request(app).post(`${API}/schedule/check`).set(...bearer('fahim'))
      .send({ start: at(6, 16), end: at(6, 17), venue_id: VENUE_IDS.seminarRoom, capacity: 500 });
    const codes = res.body.errors.map((i: { code: string }) => i.code);
    expect(codes).toEqual(expect.arrayContaining(['VENUE_CONFLICT', 'VENUE_CAPACITY']));
  });

  it('returns 404 for an unknown venue', async () => {
    const res = await request(app).post(`${API}/schedule/check`).set(...bearer('fahim'))
      .send({ start: at(9, 10), end: at(9, 12), venue_id: 'nope' });
    expect(res.status).toBe(404);
  });
});

describe('event create/edit/submit/review enforcement', () => {
  it('creates at a free slot and mirrors the venue name', async () => {
    const res = await request(app).post(`${API}/events`).set(...bearer('fahim')).send(draft({ venue_id: VENUE_IDS.auditorium }));
    expect(res.status).toBe(201);
    expect(res.body.schedule_warnings).toEqual([]);
    const row = await db.queryOne<{ venue: string; venue_id: string }>('SELECT venue, venue_id FROM events WHERE id = $1', [res.body.eventId]);
    expect(row).toEqual({ venue: '[Demo] Auditorium', venue_id: VENUE_IDS.auditorium });
  });

  it('409s a draft during midterms', async () => {
    const res = await request(app).post(`${API}/events`).set(...bearer('fahim')).send(draft({ venue: 'Room 1', start_time: at(43, 10) }));
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('SCHEDULE_CONFLICT');
    expect(res.body.issues[0].path).toBe('BLACKOUT_BLOCK');
  });

  it('409s a venue double-booking; executives cannot override, admins can (audited)', async () => {
    const body = draft({ venue_id: VENUE_IDS.seminarRoom, start_time: at(6, 16) });
    const plain = await request(app).post(`${API}/events`).set(...bearer('fahim')).send(body);
    expect(plain.status).toBe(409);
    expect(plain.body.issues.map((i: { path: string }) => i.path)).toContain('VENUE_CONFLICT');

    const exec = await request(app).post(`${API}/events`).set(...bearer('fahim')).send({ ...body, override_reason: 'Joint session' });
    expect(exec.status).toBe(403);

    const admin = await request(app).post(`${API}/events`).set(...bearer('admin')).send({ ...body, override_reason: 'Joint session agreed' });
    expect(admin.status).toBe(201);
    const audit = await db.queryOne<{ details: string }>(
      "SELECT details FROM audit_logs WHERE action = 'EVENT_SCHEDULE_OVERRIDE' AND entity_id = $1", [admin.body.eventId]
    );
    expect(audit?.details).toContain('VENUE_CONFLICT');
  });

  it('re-checks on PATCH when the venue changes', async () => {
    const created = await request(app).post(`${API}/events`).set(...bearer('fahim'))
      .send(draft({ venue: 'TBD', start_time: at(6, 15) }));
    expect(created.status).toBe(201);
    const id = created.body.eventId as string;
    const clash = await request(app).patch(`${API}/events/${id}`).set(...bearer('fahim')).send({ venue_id: VENUE_IDS.seminarRoom });
    expect(clash.status).toBe(409);
    const ok = await request(app).patch(`${API}/events/${id}`).set(...bearer('fahim')).send({ venue_id: VENUE_IDS.multipurposeHall });
    expect(ok.status).toBe(200);
    expect(ok.body.event.venue).toBe('[Demo] Multipurpose Hall');
    const titleOnly = await request(app).patch(`${API}/events/${id}`).set(...bearer('fahim')).send({ title: 'Renamed Event' });
    expect(titleOnly.status).toBe(200);
  });

  it('submit re-checks against pending bookings; review re-checks inside the transaction', async () => {
    const start = at(11, 9);
    const a = await request(app).post(`${API}/events`).set(...bearer('fahim')).send(draft({ venue_id: VENUE_IDS.computerLab501, start_time: start }));
    const b = await request(app).post(`${API}/events`).set(...bearer('fahim')).send(draft({ venue_id: VENUE_IDS.computerLab501, start_time: plusHours(start, 1) }));
    expect([a.status, b.status]).toEqual([201, 201]);

    expect((await request(app).post(`${API}/events/${a.body.eventId}/submit`).set(...bearer('fahim'))).status).toBe(200);
    const bSubmit = await request(app).post(`${API}/events/${b.body.eventId}/submit`).set(...bearer('fahim'));
    expect(bSubmit.status).toBe(409);

    // Simulate a racing submission that slipped in, then try to approve A.
    await db.execute("UPDATE events SET status = 'PENDING_APPROVAL' WHERE id = $1", [b.body.eventId]);
    const review = await request(app).post(`${API}/events/${a.body.eventId}/review`).set(...bearer('jobair')).send({ decision: 'APPROVED' });
    expect(review.status).toBe(409);
    const stillPending = await db.queryOne<{ status: string }>('SELECT status FROM events WHERE id = $1', [a.body.eventId]);
    expect(stillPending?.status).toBe('PENDING_APPROVAL');

    const rejectB = await request(app).post(`${API}/events/${b.body.eventId}/review`).set(...bearer('jobair')).send({ decision: 'REJECTED', remarks: 'Lab clash' });
    expect(rejectB.status).toBe(200);
    const approveA = await request(app).post(`${API}/events/${a.body.eventId}/review`).set(...bearer('jobair')).send({ decision: 'APPROVED', po_tags: [{ code: 'PO5', weight: 2 }] });
    expect(approveA.status).toBe(200);
  });
});

describe('GET /venues/:id/free-slots', () => {
  it('suggests up to 5 slots that avoid existing bookings', async () => {
    const debateDay = new Date(Date.parse(at(6, 12)) + 6 * 3_600_000).toISOString().slice(0, 10);
    const res = await request(app).get(`${API}/venues/${VENUE_IDS.seminarRoom}/free-slots`).set(...bearer('fahim'))
      .query({ date: debateDay, duration: 240 });
    expect(res.status).toBe(200);
    expect(res.body.slots.length).toBeGreaterThan(0);
    expect(res.body.slots.length).toBeLessThanOrEqual(5);
    const debate = { s: Date.parse(at(6, 15)), e: Date.parse(at(6, 18)) };
    for (const slot of res.body.slots as { start: string; end: string }[]) {
      expect(Date.parse(slot.start) < debate.e && Date.parse(slot.end) > debate.s).toBe(false);
    }
  });

  it('validates the query and the venue', async () => {
    expect((await request(app).get(`${API}/venues/${VENUE_IDS.seminarRoom}/free-slots`).set(...bearer('fahim')).query({ date: '10/11/2026' })).status).toBe(400);
    expect((await request(app).get(`${API}/venues/nope/free-slots`).set(...bearer('fahim')).query({ date: '2026-11-10' })).status).toBe(404);
  });
});

describe('admin calendar and venue CRUD', () => {
  it('creates and edits a blackout (ADMIN only)', async () => {
    const body = { kind: 'HOLIDAY', title_en: 'Campus closed', title_bn: 'ক্যাম্পাস বন্ধ', starts_at: at(60, 0), ends_at: at(61, 0), severity: 'BLOCK' };
    expect((await request(app).post(`${API}/calendar/blackouts`).set(...bearer('fahim')).send(body)).status).toBe(403);
    expect((await request(app).post(`${API}/calendar/blackouts`).set(...bearer('admin')).send({ ...body, ends_at: at(59, 0) })).status).toBe(400);
    const created = await request(app).post(`${API}/calendar/blackouts`).set(...bearer('admin')).send(body);
    expect(created.status).toBe(201);
    const id = created.body.blackout.id as string;
    const patched = await request(app).patch(`${API}/calendar/blackouts/${id}`).set(...bearer('admin')).send({ severity: 'WARN', tentative: true });
    expect(patched.status).toBe(200);
    expect(patched.body.blackout).toMatchObject({ severity: 'WARN', tentative: 1 });
    expect((await request(app).patch(`${API}/calendar/blackouts/${id}`).set(...bearer('admin')).send({ ends_at: at(59, 0) })).status).toBe(400);
    expect((await request(app).patch(`${API}/calendar/blackouts/missing`).set(...bearer('admin')).send({ severity: 'WARN' })).status).toBe(404);
  });

  it('creates and edits a venue (ADMIN only, unique name)', async () => {
    const body = { name: 'Test Studio', capacity: 30, latitude: 23.8, longitude: 90.43 };
    expect((await request(app).post(`${API}/venues`).set(...bearer('fahim')).send(body)).status).toBe(403);
    const created = await request(app).post(`${API}/venues`).set(...bearer('admin')).send(body);
    expect(created.status).toBe(201);
    expect((await request(app).post(`${API}/venues`).set(...bearer('admin')).send(body)).status).toBe(409);
    const id = created.body.venue.id as string;
    const patched = await request(app).patch(`${API}/venues/${id}`).set(...bearer('admin')).send({ capacity: 40, is_active: false });
    expect(patched.status).toBe(200);
    expect(patched.body.venue).toMatchObject({ capacity: 40, is_active: 0 });
    const list = await request(app).get(`${API}/venues`);
    expect(list.body.venues.some((v: { id: string }) => v.id === id)).toBe(false);
    expect((await request(app).patch(`${API}/venues/missing`).set(...bearer('admin')).send({ capacity: 5 })).status).toBe(404);
    expect((await request(app).post(`${API}/venues`).set(...bearer('admin')).send({ name: 'X', capacity: 0 })).status).toBe(400);
  });
});
