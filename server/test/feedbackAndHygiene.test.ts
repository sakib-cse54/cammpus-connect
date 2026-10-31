import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { db } from '../src/db/index.js';
import { seedDatabase } from '../src/db/seed.js';
import { IDS } from '../src/db/demoData.js';
import { bearer } from './helpers.js';

const API = '/api/v1';

beforeAll(async () => {
  await seedDatabase();
});

describe('Feedback submission and error hygiene', () => {
  const pastEvent = 'event-demo-cse-contest-past';

  it('rejects unauthenticated feedback submissions with 401', async () => {
    const res = await request(app)
      .post(`${API}/events/${pastEvent}/feedback`)
      .send({ rating: 5, comments: 'Great event' });
    expect(res.status).toBe(401);
  });

  it('rejects feedback for non-existent events with 404', async () => {
    const res = await request(app)
      .post(`${API}/events/event-does-not-exist/feedback`)
      .set(...bearer('rahim'))
      .send({ rating: 5, comments: 'Great' });
    expect(res.status).toBe(404);
  });

  it('validates rating input bounds with 400', async () => {
    const tooLow = await request(app)
      .post(`${API}/events/${pastEvent}/feedback`)
      .set(...bearer('rahim'))
      .send({ rating: 0, comments: 'Too low' });
    expect(tooLow.status).toBe(400);

    const tooHigh = await request(app)
      .post(`${API}/events/${pastEvent}/feedback`)
      .set(...bearer('rahim'))
      .send({ rating: 6, comments: 'Too high' });
    expect(tooHigh.status).toBe(400);

    const nonInteger = await request(app)
      .post(`${API}/events/${pastEvent}/feedback`)
      .set(...bearer('rahim'))
      .send({ rating: 4.5, comments: 'Fractional' });
    expect(nonInteger.status).toBe(400);
  });

  it('rejects feedback from users who did not attend with 403', async () => {
    const res = await request(app)
      .post(`${API}/events/${pastEvent}/feedback`)
      .set(...bearer('nusrat'))
      .send({ rating: 5, comments: 'Did not attend' });
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('verified attendees');
  });

  it('allows verified attendees to submit feedback with 201', async () => {
    const res = await request(app)
      .post(`${API}/events/${pastEvent}/feedback`)
      .set(...bearer('rahim'))
      .send({ rating: 5, comments: 'Awesome contest, learned graph algorithms.', is_anonymous: false });
    expect(res.status).toBe(201);
    expect(res.body.feedbackId).toBeDefined();
  });

  it('prevents duplicate feedback submission with 409', async () => {
    const dup = await request(app)
      .post(`${API}/events/${pastEvent}/feedback`)
      .set(...bearer('rahim'))
      .send({ rating: 4, comments: 'Second attempt' });
    expect(dup.status).toBe(409);
    expect(dup.body.error).toContain('already submitted');
  });

  it('returns 404 when querying feedback for non-existent event', async () => {
    const res = await request(app)
      .get(`${API}/events/non-existent-event-id/feedback`)
      .set(...bearer('admin'));
    expect(res.status).toBe(404);
  });

  it('handles concurrent feedback submissions atomically without duplicate rows', async () => {
    const concurrentEventId = 'event-test-concurrent-feedback';
    await db.execute(
      `INSERT INTO events (
        id, club_id, title, description, venue, start_time, end_time,
        capacity, registered_count, registration_deadline, status,
        requires_feedback_for_cert, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, $9, 'COMPLETED', 1, $10)`,
      [
        concurrentEventId,
        IDS.computerClub,
        'Concurrent Test Event',
        'Testing concurrency',
        'Room 101',
        '2026-10-01T10:00:00Z',
        '2026-10-01T12:00:00Z',
        50,
        '2026-10-01T09:00:00Z',
        IDS.shakhawat
      ]
    );

    const regId = 'reg-test-concurrent-nusrat';
    await db.execute(
      `INSERT INTO registrations (id, event_id, user_id, ticket_code, status, created_at)
       VALUES ($1, $2, $3, 'TCK-CONCURRENT-NUSRAT', 'ATTENDED', $4)`,
      [regId, concurrentEventId, IDS.nusrat, new Date().toISOString()]
    );

    await db.execute(
      `INSERT INTO attendance_records (id, event_id, user_id, registration_id, check_in_time, method, recorded_by)
       VALUES ($1, $2, $3, $4, $5, 'QR_DYNAMIC', $6)`,
      ['att-test-concurrent-nusrat', concurrentEventId, IDS.nusrat, regId, new Date().toISOString(), IDS.shakhawat]
    );

    const [res1, res2] = await Promise.all([
      request(app)
        .post(`${API}/events/${concurrentEventId}/feedback`)
        .set(...bearer('nusrat'))
        .send({ rating: 5, comments: 'Concurrent feedback 1' }),
      request(app)
        .post(`${API}/events/${concurrentEventId}/feedback`)
        .set(...bearer('nusrat'))
        .send({ rating: 4, comments: 'Concurrent feedback 2' })
    ]);

    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([201, 409]);
  });
});

describe('Club existence verification across endpoints', () => {
  it('returns 404 for non-existent club member listing', async () => {
    const res = await request(app)
      .get(`${API}/clubs/non-existent-club-id/members`)
      .set(...bearer('rahim'));
    expect(res.status).toBe(404);
  });

  it('returns 404 for non-existent club events listing', async () => {
    const res = await request(app)
      .get(`${API}/clubs/non-existent-club-id/events`)
      .set(...bearer('admin'));
    expect(res.status).toBe(404);
  });

  it('returns 404 when admin drafts event for non-existent club', async () => {
    const res = await request(app)
      .post(`${API}/events`)
      .set(...bearer('admin'))
      .send({
        club_id: 'non-existent-club-id',
        title: 'Draft for Ghost Club',
        description: 'Should fail with 404 not 500 foreign key crash',
        start_time: '2026-11-20T10:00:00Z',
        end_time: '2026-11-20T12:00:00Z',
        registration_deadline: '2026-11-20T09:00:00Z',
        capacity: 100,
        venue: 'Main Auditorium'
      });
    expect(res.status).toBe(404);
    expect(res.body.error).toContain('Club not found');
  });

  it('returns 404 when admin creates announcement for non-existent club', async () => {
    const res = await request(app)
      .post(`${API}/clubs/non-existent-club-id/announcements`)
      .set(...bearer('admin'))
      .send({
        title: 'Ghost Announcement',
        content: 'Should fail with 404 not 500 foreign key crash',
        priority: 'NORMAL'
      });
    expect(res.status).toBe(404);
    expect(res.body.error).toContain('Club not found');
  });
});

describe('Club creation validation and error hygiene', () => {
  it('rejects unauthenticated club creation with 401', async () => {
    const res = await request(app)
      .post(`${API}/clubs`)
      .send({ name: 'Robo Society', slug: 'robo-soc' });
    expect(res.status).toBe(401);
  });

  it('rejects non-admin club creation with 403', async () => {
    const res = await request(app)
      .post(`${API}/clubs`)
      .set(...bearer('rahim'))
      .send({
        name: 'Student Club',
        slug: 'student-club',
        description: 'A club by students',
        category: 'Tech',
        faculty_advisor_id: IDS.jobair
      });
    expect(res.status).toBe(403);
  });

  it('rejects invalid club slug formatting with 400', async () => {
    const res = await request(app)
      .post(`${API}/clubs`)
      .set(...bearer('admin'))
      .send({
        name: 'Invalid Slug Club',
        slug: 'INVALID SLUG!',
        description: 'Valid description for the club',
        category: 'Technology',
        faculty_advisor_id: IDS.jobair
      });
    expect(res.status).toBe(400);
  });

  it('rejects club creation with non-existent or invalid advisor with 400', async () => {
    const res = await request(app)
      .post(`${API}/clubs`)
      .set(...bearer('admin'))
      .send({
        name: 'Orphan Club',
        slug: 'orphan-club',
        description: 'Valid description for the club',
        category: 'Technology',
        faculty_advisor_id: 'non-existent-advisor-id'
      });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_ADVISOR');
  });

  it('rejects club creation with a student as advisor with 400', async () => {
    const res = await request(app)
      .post(`${API}/clubs`)
      .set(...bearer('admin'))
      .send({
        name: 'Student Advised Club',
        slug: 'student-advised-club',
        description: 'Valid description for the club',
        category: 'Technology',
        faculty_advisor_id: IDS.rahim
      });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_ADVISOR');
  });

  it('successfully creates a club with valid admin data with 201', async () => {
    const res = await request(app)
      .post(`${API}/clubs`)
      .set(...bearer('admin'))
      .send({
        name: 'Autonomous Drone Society',
        slug: 'drone-society',
        description: 'Research and design of unmanned aerial robotics systems.',
        category: 'Technology & Engineering',
        faculty_advisor_id: IDS.jobair
      });
    expect(res.status).toBe(201);
    expect(res.body.clubId).toBeDefined();
  });

  it('rejects duplicate club name or slug with 409', async () => {
    const res = await request(app)
      .post(`${API}/clubs`)
      .set(...bearer('admin'))
      .send({
        name: 'Autonomous Drone Society',
        slug: 'drone-society-alt',
        description: 'Another club with duplicate name',
        category: 'Technology & Engineering',
        faculty_advisor_id: IDS.jobair
      });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CLUB_EXISTS');
  });
});

describe('Notifications endpoint authentication and ownership', () => {
  it('rejects unauthenticated notifications request with 401', async () => {
    const res = await request(app).get(`${API}/notifications`);
    expect(res.status).toBe(401);
  });

  it('allows authenticated users to fetch notifications with 200', async () => {
    const res = await request(app).get(`${API}/notifications`).set(...bearer('rahim'));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.notifications)).toBe(true);
  });

  it('rejects unauthenticated notification read patch with 401', async () => {
    const res = await request(app).patch(`${API}/notifications/some-id/read`);
    expect(res.status).toBe(401);
  });

  it('returns 404 when notification does not exist', async () => {
    const res = await request(app)
      .patch(`${API}/notifications/notif-does-not-exist/read`)
      .set(...bearer('rahim'));
    expect(res.status).toBe(404);
  });

  it('returns 403 when trying to mark another user notification as read', async () => {
    // Insert a notification owned by fahim
    const notifId = 'notif-test-ownership-1';
    await db.execute(
      `INSERT INTO notifications (id, user_id, title, message, link_url, is_read, created_at)
       VALUES ($1, $2, 'Test Notice', 'Message for Fahim', '/test', 0, $3)`,
      [notifId, IDS.fahim, new Date().toISOString()]
    );

    // Rahim attempts to mark it as read
    const res = await request(app)
      .patch(`${API}/notifications/${notifId}/read`)
      .set(...bearer('rahim'));
    expect(res.status).toBe(403);

    // Fahim marks it as read successfully
    const ok = await request(app)
      .patch(`${API}/notifications/${notifId}/read`)
      .set(...bearer('fahim'));
    expect(ok.status).toBe(200);
  });
});
