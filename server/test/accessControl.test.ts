import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { db } from '../src/db/index.js';
import { seedDatabase } from '../src/db/seed.js';
import { IDS } from '../src/db/demoData.js';
import { bearer } from './helpers.js';

const API = '/api/v1';
const iso = (minutesFromNow: number): string => new Date(Date.now() + minutesFromNow * 60_000).toISOString();

async function addMembership(id: string, clubId: string, userId: string, status: string): Promise<void> {
  await db.execute(
    `INSERT INTO club_memberships (id, club_id, user_id, club_role, status, joined_at) VALUES ($1, $2, $3, 'MEMBER', $4, NULL)
     ON CONFLICT (id) DO UPDATE SET status = excluded.status, club_role = 'MEMBER'`,
    [id, clubId, userId, status]
  );
}

beforeAll(async () => {
  await seedDatabase();
});

describe('club membership review (cross-club IDOR)', () => {
  it('returns 404 when reviewing another club\'s membership through your own club', async () => {
    const res = await request(app).patch(`${API}/clubs/${IDS.itClub}/members/mem-demo-8`)
      .set(...bearer('tanvir')).send({ decision: 'APPROVED', role: 'PRESIDENT' });
    expect(res.status).toBe(404);
    const row = await db.queryOne<{ status: string; club_role: string }>("SELECT status, club_role FROM club_memberships WHERE id = 'mem-demo-8'");
    expect(row).toEqual({ status: 'PENDING', club_role: 'MEMBER' });
  });

  it('ignores body club_id when the URL names a club', async () => {
    const res = await request(app).patch(`${API}/clubs/${IDS.englishClub}/members/mem-demo-8`)
      .set(...bearer('tanvir')).send({ decision: 'APPROVED', club_id: IDS.itClub });
    expect(res.status).toBe(403);
  });

  it('forbids reviewing your own membership', async () => {
    await addMembership('mem-admin-self', IDS.lawClub, IDS.admin, 'PENDING');
    const res = await request(app).patch(`${API}/clubs/${IDS.lawClub}/members/mem-admin-self`)
      .set(...bearer('admin')).send({ decision: 'APPROVED' });
    expect(res.status).toBe(403);
  });

  it('validates decision and role (400)', async () => {
    await addMembership('mem-nusrat-cc', IDS.computerClub, IDS.nusrat, 'PENDING');
    const res = await request(app).patch(`${API}/clubs/${IDS.computerClub}/members/mem-nusrat-cc`)
      .set(...bearer('fahim')).send({ decision: 'APPROVED', role: 'GOD' });
    expect(res.status).toBe(400);
    expect(res.body.issues).toBeDefined();
  });

  it('only lets the advisor or admin grant PRESIDENT; users.role is unchanged on refusal', async () => {
    const res = await request(app).patch(`${API}/clubs/${IDS.computerClub}/members/mem-nusrat-cc`)
      .set(...bearer('fahim')).send({ decision: 'APPROVED', role: 'PRESIDENT' });
    expect(res.status).toBe(403);
    const u = await db.queryOne<{ role: string }>('SELECT role FROM users WHERE id = $1', [IDS.nusrat]);
    expect(u?.role).toBe('STUDENT');
  });

  it('allows an executive to approve a pending MEMBER, then 409 on re-review', async () => {
    const ok = await request(app).patch(`${API}/clubs/${IDS.computerClub}/members/mem-nusrat-cc`)
      .set(...bearer('fahim')).send({ decision: 'APPROVED', role: 'MEMBER' });
    expect(ok.status).toBe(200);
    const again = await request(app).patch(`${API}/clubs/${IDS.computerClub}/members/mem-nusrat-cc`)
      .set(...bearer('fahim')).send({ decision: 'REJECTED' });
    expect(again.status).toBe(409);
  });

  it('shows the full member list to executives but only names and roles to members', async () => {
    const exec = await request(app).get(`${API}/clubs/${IDS.computerClub}/members`).set(...bearer('fahim'));
    expect(exec.body.view).toBe('FULL');
    expect(exec.body.members[0].email).toBeDefined();
    const member = await request(app).get(`${API}/clubs/${IDS.computerClub}/members`).set(...bearer('rahim'));
    expect(member.body.view).toBe('PUBLIC');
    for (const m of member.body.members) expect(Object.keys(m).sort()).toEqual(['club_role', 'full_name']);
  });

  it('omits email and student id from the public club profile', async () => {
    const res = await request(app).get(`${API}/clubs/computer-club`);
    expect(res.status).toBe(200);
    for (const e of res.body.executives) {
      expect(e.email).toBeUndefined();
      expect(e.student_id_number).toBeUndefined();
    }
  });
});

describe('announcements', () => {
  it('uses the URL club and notifies only that club\'s members', async () => {
    const res = await request(app).post(`${API}/clubs/${IDS.computerClub}/announcements`)
      .set(...bearer('fahim')).send({ club_id: IDS.itClub, title: 'Scoped notice', content: 'Hello computer club' });
    expect(res.status).toBe(201);
    const ann = await db.queryOne<{ club_id: string }>('SELECT club_id FROM announcements WHERE id = $1', [res.body.announcementId]);
    expect(ann?.club_id).toBe(IDS.computerClub);
    const tanvir = await db.queryOne<{ n: number }>("SELECT COUNT(*) AS n FROM notifications WHERE user_id = $1 AND title = 'Scoped notice'", [IDS.tanvir]);
    const rahim = await db.queryOne<{ n: number }>("SELECT COUNT(*) AS n FROM notifications WHERE user_id = $1 AND title = 'Scoped notice'", [IDS.rahim]);
    expect(tanvir?.n).toBe(0);
    expect(rahim?.n).toBe(1);
  });
});

describe('event visibility', () => {
  it('rejects non-public status filters and never lists drafts', async () => {
    expect((await request(app).get(`${API}/events?status=DRAFT`)).status).toBe(400);
    const list = await request(app).get(`${API}/events`);
    expect(list.body.events.every((e: { status: string }) => e.status === 'PUBLISHED')).toBe(true);
  });

  it('hides non-public events by id from outsiders but not from the club', async () => {
    expect((await request(app).get(`${API}/events/${IDS.techFest}`)).status).toBe(404);
    expect((await request(app).get(`${API}/events/${IDS.techFest}`).set(...bearer('tanvir'))).status).toBe(404);
    expect((await request(app).get(`${API}/events/${IDS.techFest}`).set(...bearer('fahim'))).status).toBe(200);
  });

  it('returns userRegistration for a logged-in viewer (optional auth)', async () => {
    const res = await request(app).get(`${API}/events/${IDS.workshop}`).set(...bearer('rahim'));
    expect(res.body.userRegistration?.user_id).toBe(IDS.rahim);
    const anon = await request(app).get(`${API}/events/${IDS.workshop}`);
    expect(anon.body.userRegistration).toBeNull();
  });

  it('lists the clubs the caller manages', async () => {
    const res = await request(app).get(`${API}/me/clubs`).set(...bearer('fahim'));
    const roles = Object.fromEntries(res.body.clubs.map((c: { id: string; role: string }) => [c.id, c.role]));
    expect(roles).toEqual({ [IDS.computerClub]: 'EXECUTIVE', [IDS.roboticsClub]: 'EXECUTIVE' });
    const adv = await request(app).get(`${API}/me/clubs`).set(...bearer('arif'));
    expect(adv.body.clubs.map((c: { role: string }) => c.role)).toEqual(['FACULTY_ADVISOR', 'FACULTY_ADVISOR']);
  });
});

describe('event lifecycle', () => {
  const payload = {
    club_id: IDS.computerClub, title: 'Lifecycle Test Event', venue: 'Room 101',
    start_time: '2027-01-10T10:00:00+06:00', end_time: '2027-01-10T12:00:00+06:00',
    registration_deadline: '2027-01-09T23:59:59+06:00', capacity: 2
  };
  let eventId = '';

  it('validates the payload', async () => {
    const bad1 = await request(app).post(`${API}/events`).set(...bearer('fahim')).send({ ...payload, capacity: 'abc' });
    const bad2 = await request(app).post(`${API}/events`).set(...bearer('fahim'))
      .send({ ...payload, end_time: '2027-01-10T09:00:00+06:00' });
    const bad3 = await request(app).post(`${API}/events`).set(...bearer('fahim')).send({ ...payload, start_time: '2027-01-10 10:00' });
    expect([bad1.status, bad2.status, bad3.status]).toEqual([400, 400, 400]);
  });

  it('requires club executive scope for create', async () => {
    const res = await request(app).post(`${API}/events`).set(...bearer('tanvir')).send(payload);
    expect(res.status).toBe(403);
  });

  it('creates a draft stored in UTC, visible on the club events list', async () => {
    const res = await request(app).post(`${API}/events`).set(...bearer('fahim')).send(payload);
    expect(res.status).toBe(201);
    eventId = res.body.eventId;
    const row = await db.queryOne<{ start_time: string }>('SELECT start_time FROM events WHERE id = $1', [eventId]);
    expect(row?.start_time).toBe('2027-01-10T04:00:00.000Z');
    const list = await request(app).get(`${API}/clubs/${IDS.computerClub}/events`).set(...bearer('fahim'));
    expect(list.body.events.some((e: { id: string; status: string }) => e.id === eventId && e.status === 'DRAFT')).toBe(true);
    expect((await request(app).get(`${API}/clubs/${IDS.computerClub}/events`).set(...bearer('tanvir'))).status).toBe(403);
  });

  it('rejects reviewing a DRAFT (409) and edits it via PATCH', async () => {
    expect((await request(app).post(`${API}/events/${eventId}/review`).set(...bearer('jobair')).send({ decision: 'APPROVED' })).status).toBe(409);
    const patch = await request(app).patch(`${API}/events/${eventId}`).set(...bearer('fahim')).send({ capacity: 1, title: 'Lifecycle Test Event v2' });
    expect(patch.status).toBe(200);
    expect(patch.body.event.capacity).toBe(1);
    const badPatch = await request(app).patch(`${API}/events/${eventId}`).set(...bearer('fahim')).send({ registration_deadline: '2027-01-11T00:00:00+06:00' });
    expect(badPatch.status).toBe(400);
    expect((await request(app).patch(`${API}/events/${eventId}`).set(...bearer('tanvir')).send({ capacity: 3 })).status).toBe(403);
  });

  it('submits once, then only the club advisor can approve', async () => {
    expect((await request(app).post(`${API}/events/${eventId}/submit`).set(...bearer('fahim'))).status).toBe(200);
    expect((await request(app).post(`${API}/events/${eventId}/submit`).set(...bearer('fahim'))).status).toBe(409);
    expect((await request(app).patch(`${API}/events/${eventId}`).set(...bearer('fahim')).send({ capacity: 3 })).status).toBe(409);
    expect((await request(app).post(`${API}/events/${eventId}/review`).set(...bearer('arif')).send({ decision: 'APPROVED' })).status).toBe(403);
    expect((await request(app).post(`${API}/events/${eventId}/review`).set(...bearer('jobair')).send({ decision: 'REJECTED' })).status).toBe(400);
    expect((await request(app).post(`${API}/events/${eventId}/review`).set(...bearer('jobair')).send({ decision: 'APPROVED', po_tags: [{ code: 'PO9', weight: 2 }] })).status).toBe(200);
    expect((await request(app).post(`${API}/events/${eventId}/review`).set(...bearer('jobair')).send({ decision: 'APPROVED' })).status).toBe(409);
  });

  it('cancels with reason: registrations cancelled and registrants notified', async () => {
    expect((await request(app).post(`${API}/events/${eventId}/register`).set(...bearer('rahim'))).body.status).toBe('CONFIRMED');
    expect((await request(app).post(`${API}/events/${eventId}/register`).set(...bearer('ayesha'))).body.status).toBe('WAITLISTED');
    expect((await request(app).post(`${API}/events/${eventId}/cancel`).set(...bearer('fahim')).send({})).status).toBe(400);
    expect((await request(app).post(`${API}/events/${eventId}/cancel`).set(...bearer('tanvir')).send({ reason: 'nope' })).status).toBe(403);
    const res = await request(app).post(`${API}/events/${eventId}/cancel`).set(...bearer('fahim')).send({ reason: 'Venue unavailable' });
    expect(res.status).toBe(200);
    const ev = await db.queryOne<{ status: string; cancellation_reason: string; registered_count: number }>(
      'SELECT status, cancellation_reason, registered_count FROM events WHERE id = $1', [eventId]);
    expect(ev).toEqual({ status: 'CANCELLED', cancellation_reason: 'Venue unavailable', registered_count: 0 });
    const regs = await db.query<{ status: string }>('SELECT status FROM registrations WHERE event_id = $1', [eventId]);
    expect(regs.every((r) => r.status === 'CANCELLED')).toBe(true);
    const notes = await db.queryOne<{ n: number }>(
      "SELECT COUNT(*) AS n FROM notifications WHERE link_url = $1 AND title LIKE 'Event cancelled%'", [`/events/${eventId}`]);
    expect(notes?.n).toBe(2);
    expect((await request(app).post(`${API}/events/${eventId}/cancel`).set(...bearer('fahim')).send({ reason: 'Again please' })).status).toBe(409);
  });

  it('returns 404 when cancelling an unknown event', async () => {
    expect((await request(app).post(`${API}/events/nope-123/cancel`).set(...bearer('admin')).send({ reason: 'Whatever' })).status).toBe(404);
  });

  it('completes only PUBLISHED events after their end time', async () => {
    expect((await request(app).post(`${API}/events/${IDS.workshop}/complete`).set(...bearer('fahim'))).status).toBe(400);
    expect((await request(app).post(`${API}/events/${IDS.techFest}/complete`).set(...bearer('fahim'))).status).toBe(409);
    await db.execute(
      `INSERT INTO events (id, club_id, title, description, venue, start_time, end_time, capacity, registered_count,
         registration_deadline, status, requires_feedback_for_cert, created_by)
       VALUES ('event-ended-pub', $1, 'Ended', '', 'Hall', $2, $3, 10, 0, $4, 'PUBLISHED', 0, $5)
       ON CONFLICT (id) DO NOTHING`,
      [IDS.computerClub, iso(-180), iso(-60), iso(-240), IDS.fahim]);
    expect((await request(app).post(`${API}/events/event-ended-pub/complete`).set(...bearer('jobair'))).status).toBe(200);
  });
});

describe('registration integrity', () => {
  it('refuses to cancel an ATTENDED registration', async () => {
    const res = await request(app).post(`${API}/registrations/reg-1/cancel`).set(...bearer('rahim'));
    expect(res.status).toBe(400);
  });

  it('refuses registration once the event has started', async () => {
    const res = await request(app).post(`${API}/events/${IDS.workshop}/register`).set(...bearer('nusrat'));
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('already started');
  });

  it('enforces a +06:00 deadline on the true instant', async () => {
    await db.execute(
      `INSERT INTO events (id, club_id, title, description, venue, start_time, end_time, capacity, registered_count,
         registration_deadline, status, requires_feedback_for_cert, created_by)
       VALUES ('event-deadline-past', $1, 'Deadline', '', 'Hall', $2, $3, 10, 0, $4, 'PUBLISHED', 0, $5)
       ON CONFLICT (id) DO NOTHING`,
      [IDS.computerClub, iso(600), iso(700), new Date(Date.now() - 60_000).toISOString().replace('Z', '+00:00'), IDS.fahim]);
    const res = await request(app).post(`${API}/events/event-deadline-past/register`).set(...bearer('nusrat'));
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('deadline');
  });
});

describe('roster CSV', () => {
  it('is club scoped and neutralizes formula injection', async () => {
    expect((await request(app).get(`${API}/events/${IDS.workshop}/roster`).set(...bearer('tanvir'))).status).toBe(403);
    await db.execute(`UPDATE student_profiles SET full_name = '=HYPERLINK("http://evil","x")' WHERE user_id = $1`, [IDS.ayesha]);
    const res = await request(app).get(`${API}/events/${IDS.workshop}/roster?format=csv`).set(...bearer('fahim'));
    expect(res.status).toBe(200);
    expect(res.text).toContain(`"'=HYPERLINK(""http://evil"",""x"")"`);
    expect(res.text).not.toMatch(/(^|,)"?=HYPERLINK/m);
  });
});

describe('attendance and feedback lists are club scoped', () => {
  it('forbids other clubs', async () => {
    expect((await request(app).get(`${API}/events/${IDS.workshop}/attendance`).set(...bearer('tanvir'))).status).toBe(403);
    expect((await request(app).get(`${API}/events/${IDS.workshop}/feedback`).set(...bearer('rahim'))).status).toBe(403);
    expect((await request(app).get(`${API}/events/${IDS.workshop}/attendance`).set(...bearer('jobair'))).status).toBe(200);
  });
});
