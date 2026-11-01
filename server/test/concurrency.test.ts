import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { db } from '../src/db/index.js';
import { seedDatabase } from '../src/db/seed.js';
import { dhakaWallTime } from '../src/utils/time.js';
import { bearer } from './helpers.js';

/** Inserts (or resets) a capacity-1 published event scheduled relative to now. */
async function upsertCapacityOneEvent(id: string, title: string, venue: string, createdBy: string, dayOffset: number): Promise<void> {
  const now = new Date();
  const start = dhakaWallTime(now, dayOffset, 10);
  const end = dhakaWallTime(now, dayOffset, 12);
  const deadline = dhakaWallTime(now, dayOffset - 1, 23, 59);
  await db.execute(
    `INSERT INTO events (
       id, club_id, title, description, venue, start_time, end_time,
       capacity, registered_count, registration_deadline, status,
       requires_feedback_for_cert, created_by
     ) VALUES ($1, 'club-uits-computer', $2, 'Testing concurrent registration requests.', $3, $4, $5,
       1, 0, $6, 'PUBLISHED', 0, $7)
     ON CONFLICT (id) DO UPDATE SET start_time = excluded.start_time, end_time = excluded.end_time,
       registration_deadline = excluded.registration_deadline, capacity = 1, registered_count = 0`,
    [id, title, venue, start.toISOString(), end.toISOString(), deadline.toISOString(), createdBy]
  );
}

describe('Concurrency-Safe Event Registration and Waitlist Engine', () => {
  let fahimToken: string;
  let eventId = 'event-concurrency-test';

  beforeAll(async () => {
    await seedDatabase();

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'fahim@university.edu', password: 'Password123!' });
    fahimToken = loginRes.body.token;

    // Create a special test event with capacity of exactly 1
    await upsertCapacityOneEvent(eventId, 'Concurrency Stress Test Lab', 'Lab 501', 'user-fahim-0432320005101007', 21);
  });

  it('should grant CONFIRMED status to the first applicant filling the slot', async () => {
    const res = await request(app)
      .post(`/api/v1/events/${eventId}/register`)
      .set('Authorization', `Bearer ${fahimToken}`);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('CONFIRMED');
    expect(res.body.ticketCode).toBeDefined();

    // Verify event registered_count is now 1
    const event = await db.queryOne<{ registered_count: number }>(
      'SELECT registered_count FROM events WHERE id = $1',
      [eventId]
    );
    expect(event?.registered_count).toBe(1);
  });

  it('should automatically place second applicant on WAITLIST when capacity is full', async () => {
    // Login as a second user (Rahim)
    const rahimLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'rahim@university.edu', password: 'Password123!' });
    const rahimToken = rahimLogin.body.token;

    const res = await request(app)
      .post(`/api/v1/events/${eventId}/register`)
      .set('Authorization', `Bearer ${rahimToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('WAITLISTED');
    expect(res.body.waitlistPosition).toBe(1);

    // Event registered_count must remain at capacity 1 (zero overbooking)
    const event = await db.queryOne<{ registered_count: number }>(
      'SELECT registered_count FROM events WHERE id = $1',
      [eventId]
    );
    expect(event?.registered_count).toBe(1);
  });

  it('should automatically promote waitlisted applicant when confirmed attendee cancels', async () => {
    // Fahim cancels registration
    const fahimReg = await db.queryOne<{ id: string }>(
      'SELECT id FROM registrations WHERE event_id = $1 AND user_id = $2',
      [eventId, 'user-fahim-0432320005101007']
    );

    const cancelRes = await request(app)
      .post(`/api/v1/registrations/${fahimReg!.id}/cancel`)
      .set('Authorization', `Bearer ${fahimToken}`);

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.promotedWaitlistCandidate).toBe(true);

    // Verify Rahim's status is now promoted to CONFIRMED
    const rahimReg = await db.queryOne<{ status: string; waitlist_position: number | null }>(
      'SELECT status, waitlist_position FROM registrations WHERE event_id = $1 AND user_id = $2',
      [eventId, 'user-student-2']
    );
    expect(rahimReg?.status).toBe('CONFIRMED');
    expect(rahimReg?.waitlist_position).toBeNull();
  });

  it('should allow a previously cancelled attendee to re-register without unique constraint failure', async () => {
    // Fahim attempts to re-register for the event where capacity is now taken by Rahim
    const res = await request(app)
      .post(`/api/v1/events/${eventId}/register`)
      .set('Authorization', `Bearer ${fahimToken}`);

    // Since Rahim has the 1 available slot, Fahim should be safely placed on the waitlist
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('WAITLISTED');
    expect(res.body.waitlistPosition).toBe(1);

    // Verify database row was updated rather than throwing a duplicate key error
    const fahimReg = await db.queryOne<{ status: string; waitlist_position: number | null }>(
      'SELECT status, waitlist_position FROM registrations WHERE event_id = $1 AND user_id = $2',
      [eventId, 'user-fahim-0432320005101007']
    );
    expect(fahimReg?.status).toBe('WAITLISTED');
    expect(fahimReg?.waitlist_position).toBe(1);
  });

  it('should support queries with repeated parameter placeholders without RangeError', async () => {
    // Repeated $1 placeholder (like club query by id or slug)
    const club = await db.queryOne(
      'SELECT id, name, slug FROM clubs WHERE id = $1 OR slug = $1',
      ['computer-club']
    );
    expect(club).toBeDefined();
    expect(club?.slug).toBe('computer-club');

    // Repeated search placeholder across 3 fields
    const searchResults = await db.query(
      'SELECT id, title FROM events WHERE (title LIKE $1 OR description LIKE $1 OR venue LIKE $1)',
      ['%Workshop%']
    );
    expect(Array.isArray(searchResults)).toBe(true);
    expect(searchResults.length).toBeGreaterThan(0);
  });

  it('should safely serialize concurrent transactions without SQLite nesting collision', async () => {
    // Launch 5 concurrent transactions simultaneously
    const tasks = Array.from({ length: 5 }, (_, i) =>
      db.transaction(async (trx) => {
        const row = await trx.queryOne<{ val: number }>('SELECT 1 as val');
        return (row?.val || 0) + i;
      })
    );

    const results = await Promise.all(tasks);
    expect(results).toEqual([1, 2, 3, 4, 5]);
  });

  it('should prevent overbooking when multiple concurrent registrations arrive at once', async () => {
    const concurrentEventId = 'event-stress-concurrent';
    await upsertCapacityOneEvent(concurrentEventId, 'High Concurrency Race Test', 'Lab 101', 'user-campus-admin', 26);

    // Rahim and Ayesha register simultaneously for an event with capacity 1
    const rahimLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'rahim@university.edu', password: 'Password123!' });
    const rahimToken = rahimLogin.body.token;

    const ayeshaLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'ayesha@university.edu', password: 'Password123!' });
    const ayeshaToken = ayeshaLogin.body.token;

    const [res1, res2] = await Promise.all([
      request(app)
        .post(`/api/v1/events/${concurrentEventId}/register`)
        .set('Authorization', `Bearer ${rahimToken}`),
      request(app)
        .post(`/api/v1/events/${concurrentEventId}/register`)
        .set('Authorization', `Bearer ${ayeshaToken}`)
    ]);

    const statuses = [res1.body.status, res2.body.status].sort();
    expect(statuses).toEqual(['CONFIRMED', 'WAITLISTED']);

    const finalEvent = await db.queryOne<{ registered_count: number }>(
      'SELECT registered_count FROM events WHERE id = $1',
      [concurrentEventId]
    );
    expect(finalEvent?.registered_count).toBe(1);
  });

  it('gives every concurrent waitlist join a distinct queue position', async () => {
    const waitlistEventId = 'event-stress-waitlist';
    await upsertCapacityOneEvent(waitlistEventId, 'Waitlist Race Test', 'Lab 102', 'user-campus-admin', 27);

    const register = (name: Parameters<typeof bearer>[0]) =>
      request(app).post(`/api/v1/events/${waitlistEventId}/register`).set(...bearer(name));

    const first = await register('rahim');
    expect(first.body.status).toBe('CONFIRMED');

    const joiners = ['ayesha', 'nusrat', 'tanvir', 'sadia', 'fahim'] as const;
    const results = await Promise.all(joiners.map((name) => register(name)));

    expect(results.map((r) => r.body.status)).toEqual(joiners.map(() => 'WAITLISTED'));
    const positions = results.map((r) => r.body.waitlistPosition as number).sort((a, b) => a - b);
    expect(positions).toEqual([1, 2, 3, 4, 5]);

    const stored = await db.query<{ waitlist_position: number }>(
      `SELECT waitlist_position FROM registrations WHERE event_id = $1 AND status = 'WAITLISTED' ORDER BY waitlist_position`,
      [waitlistEventId]
    );
    expect(stored.map((r) => Number(r.waitlist_position))).toEqual([1, 2, 3, 4, 5]);
  });
});
