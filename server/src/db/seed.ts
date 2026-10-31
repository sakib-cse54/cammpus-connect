import bcrypt from 'bcryptjs';
import { db, DbClient } from './index.js';
import { addMinutes, nowIso } from '../utils/time.js';
import {
  DEMO_USERS, DEMO_CATEGORIES, DEMO_CLUBS, DEMO_MEMBERSHIPS, DEMO_REGISTRATIONS,
  DEMO_ATTENDANCE, DEMO_FEEDBACK, DEMO_ANNOUNCEMENTS, buildDemoEvents, DemoEvent,
  DEMO_EVENT_OUTCOMES, DEMO_REFLECTIONS
} from './demoData.js';
import { DEMO_VENUES, DEMO_EVENT_VENUES, buildDemoSemesters, buildDemoBlackouts } from './demoCalendar.js';

type Row = Readonly<Record<string, unknown>>;

/**
 * INSERT ... ON CONFLICT(target) DO UPDATE (or DO NOTHING when no update
 * columns are given). Portable across SQLite and PostgreSQL, and unlike
 * SQLite's REPLACE conflict resolution it never deletes the row, so dependent rows survive.
 * Table and column names come from constants in this file, never from input.
 */
async function upsert(
  client: DbClient, table: string, row: Row, conflict: string, update: readonly string[]
): Promise<void> {
  const cols = Object.keys(row);
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
  const action = update.length > 0
    ? `DO UPDATE SET ${update.map((c) => `${c} = excluded.${c}`).join(', ')}`
    : 'DO NOTHING';
  await client.execute(
    `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders}) ON CONFLICT ${conflict} ${action}`,
    Object.values(row)
  );
}

async function seedUsers(client: DbClient, now: string): Promise<void> {
  const hashes = {
    student: await bcrypt.hash('Password123!', 12),
    admin: await bcrypt.hash('AdminPassword123!', 12)
  };
  for (const u of DEMO_USERS) {
    await upsert(client, 'users',
      { id: u.id, email: u.email, password_hash: hashes[u.password], role: u.role, status: 'ACTIVE', created_at: now, updated_at: now },
      '(id)', ['email', 'password_hash', 'role', 'status', 'updated_at']);
    await upsert(client, 'student_profiles',
      { id: u.profileId, user_id: u.id, student_id_number: u.studentIdNumber, full_name: u.fullName, department: u.department, batch_year: u.batchYear },
      '(id)', ['full_name', 'department', 'batch_year']);
  }
}

async function seedClubs(client: DbClient, now: string): Promise<void> {
  for (const [id, name, description] of DEMO_CATEGORIES) {
    await upsert(client, 'event_categories', { id, name, description }, '(id)', ['name', 'description']);
  }
  for (const c of DEMO_CLUBS) {
    await upsert(client, 'clubs',
      { id: c.id, name: c.name, slug: c.slug, description: c.description, category: c.category, faculty_advisor_id: c.advisorId, status: 'ACTIVE', created_at: now },
      '(id)', ['name', 'slug', 'description', 'category', 'faculty_advisor_id', 'status']);
  }
  for (const [id, club_id, user_id, club_role, status] of DEMO_MEMBERSHIPS) {
    const joined_at = status === 'APPROVED' ? now : null;
    await upsert(client, 'club_memberships', { id, club_id, user_id, club_role, status, joined_at },
      '(club_id, user_id)', ['club_role', 'status']);
  }
}

async function seedEvents(client: DbClient, events: readonly DemoEvent[]): Promise<void> {
  for (const e of events) {
    await upsert(client, 'events', {
      id: e.id, club_id: e.clubId, title: e.title, description: e.description, venue: e.venue,
      start_time: e.start, end_time: e.end, capacity: e.capacity, registered_count: 0,
      registration_deadline: e.deadline, status: e.status, requires_feedback_for_cert: e.requiresFeedback, created_by: e.createdBy
    }, '(id)', ['club_id', 'title', 'description', 'venue', 'start_time', 'end_time', 'capacity',
      'registration_deadline', 'status', 'requires_feedback_for_cert']);
  }
}

/** Demo venues, a relative academic calendar, and venue links for demo events. */
async function seedCalendar(client: DbClient, now: Date, stamp: string): Promise<void> {
  for (const v of DEMO_VENUES) {
    await upsert(client, 'venues', { ...v, is_active: 1, created_at: stamp, updated_at: stamp }, '(id)',
      ['name', 'building', 'capacity', 'latitude', 'longitude', 'radius_m', 'updated_at']);
  }
  for (const s of buildDemoSemesters(now)) {
    await upsert(client, 'semesters', { ...s, created_at: stamp }, '(id)', ['name', 'start_date', 'end_date']);
  }
  for (const b of buildDemoBlackouts(now)) {
    await upsert(client, 'calendar_blackouts', { ...b, created_at: stamp, updated_at: stamp }, '(id)',
      ['title_en', 'title_bn', 'starts_at', 'ends_at', 'tentative', 'severity', 'updated_at']);
  }
  for (const [eventId, venueId] of Object.entries(DEMO_EVENT_VENUES)) {
    await client.execute(
      'UPDATE events SET venue_id = $1, venue = (SELECT name FROM venues WHERE id = $1) WHERE id = $2',
      [venueId, eventId]
    );
  }
}

/** Participation rows are DO NOTHING so re-seeding never rewrites real activity. */
async function seedParticipation(client: DbClient, events: readonly DemoEvent[], now: Date): Promise<void> {
  const startOf = new Map(events.map((e) => [e.id, e.start]));
  for (const [id, event_id, user_id, ticket_code, status] of DEMO_REGISTRATIONS) {
    await upsert(client, 'registrations',
      { id, event_id, user_id, ticket_code, status, waitlist_position: null, created_at: addMinutes(now, -60 * 24 * 20).toISOString() }, '', []);
  }
  for (const [id, event_id, user_id, registration_id, offset, recorded_by] of DEMO_ATTENDANCE) {
    const check_in_time = addMinutes(startOf.get(event_id) ?? now, offset).toISOString();
    await upsert(client, 'attendance_records',
      { id, event_id, user_id, registration_id, check_in_time, method: 'QR_SCAN', recorded_by }, '', []);
  }
  for (const [id, event_id, user_id, rating, comments] of DEMO_FEEDBACK) {
    await upsert(client, 'feedback',
      { id, event_id, user_id, rating, comments, is_anonymous: 0, submitted_at: now.toISOString() }, '', []);
  }
  for (const [id, club_id, author_id, title, content, minutesAgo] of DEMO_ANNOUNCEMENTS) {
    await upsert(client, 'announcements',
      { id, club_id, author_id, title, content, created_at: addMinutes(now, -minutesAgo).toISOString() }, '(id)', ['title', 'content']);
  }
}

/** BAETE PO tags on demo events and a sample reflection (re-seed keeps real reflections). */
async function seedOutcomes(client: DbClient, stamp: string): Promise<void> {
  for (const [event_id, tags] of Object.entries(DEMO_EVENT_OUTCOMES)) {
    for (const [po_code, weight] of tags) {
      await upsert(client, 'event_outcomes', { event_id, po_code, weight, tagged_by: null, tagged_at: stamp },
        '(event_id, po_code)', ['weight']);
    }
  }
  for (const [id, user_id, event_id, text] of DEMO_REFLECTIONS) {
    await upsert(client, 'reflections', { id, user_id, event_id, text, created_at: stamp, updated_at: stamp }, '(user_id, event_id)', []);
  }
}

/** Keeps events.registered_count consistent with the confirmed and attended rows. */
async function recountRegistrations(client: DbClient, events: readonly DemoEvent[]): Promise<void> {
  for (const e of events) {
    await client.execute(
      `UPDATE events SET registered_count = (
         SELECT COUNT(*) FROM registrations r WHERE r.event_id = $1 AND r.status IN ('CONFIRMED', 'ATTENDED')
       ) WHERE id = $1`,
      [e.id]
    );
  }
}

/** Idempotent demo seed. Safe to run repeatedly against a database with real activity. */
export async function seedDatabase(): Promise<void> {
  console.log('Seeding CampusConnect database with DEMO data...');
  const now = new Date();
  const stamp = nowIso();
  const events = buildDemoEvents(now);

  await seedUsers(db, stamp);
  await db.transaction(async (trx) => {
    await seedClubs(trx, stamp);
    await seedEvents(trx, events);
    await seedCalendar(trx, now, stamp);
    await seedParticipation(trx, events, now);
    await seedOutcomes(trx, stamp);
    await recountRegistrations(trx, events);
  });

  console.log('Demo data seeded. Demo accounts:');
  console.log('- Team leader / club president: shakhawat@university.edu / Password123!');
  console.log('- Club executive: fahim@university.edu / Password123!');
  console.log('- Faculty advisor: imtiaz@university.edu / Password123!');
  console.log('- Administrator: admin@university.edu / AdminPassword123!');
}

// Execute if run directly
if (process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js')) {
  seedDatabase().catch((err: unknown) => {
    console.error('Seeding error:', err);
    process.exit(1);
  });
}
