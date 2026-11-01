import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db, DbClient } from '../db/index.js';
import { logAudit } from '../middleware/audit.js';
import { Event, Registration } from '../types/index.js';
import { nowIso } from '../utils/time.js';
import { HttpError } from '../utils/http.js';
import { csvRow } from '../utils/csv.js';

interface RegisterResult {
  readonly status: 'CONFIRMED' | 'WAITLISTED';
  readonly ticketCode: string;
  readonly registrationId: string;
  readonly waitlistPosition?: number;
  readonly message: string;
}

type EventWindow = Pick<Event, 'id' | 'status' | 'start_time' | 'registration_deadline'>;

function assertOpenForRegistration(event: EventWindow, now: number): void {
  if (event.status !== 'PUBLISHED') {
    throw new HttpError(400, `Event is not open for registration (status: ${event.status})`);
  }
  if (now >= Date.parse(event.start_time)) {
    throw new HttpError(400, 'Registration is closed because the event has already started');
  }
  if (now > Date.parse(event.registration_deadline)) {
    throw new HttpError(400, 'Registration deadline for this event has passed');
  }
}

const ACTIVE_CONFLICTS: Readonly<Record<string, string>> = {
  CONFIRMED: 'You already hold a confirmed registration for this event',
  WAITLISTED: 'You are already on the waitlist for this event',
  ATTENDED: 'You have already attended this event'
};

/** Atomically takes a seat; false when the event is full. Correct on SQLite and PostgreSQL. */
async function takeSeat(trx: DbClient, eventId: string): Promise<boolean> {
  const r = await trx.execute(
    'UPDATE events SET registered_count = registered_count + 1 WHERE id = $1 AND registered_count < capacity',
    [eventId]
  );
  return r.rowCount > 0;
}

async function upsertRegistration(
  trx: DbClient, eventId: string, userId: string, status: 'CONFIRMED' | 'WAITLISTED'
): Promise<{ id: string; ticketCode: string; position: number | null }> {
  const ticketCode = `TCK-${uuidv4().substring(0, 8).toUpperCase()}`;
  if (status === 'WAITLISTED') {
    // Row lock held until commit: serialises waitlist joins per event so MAX()+1 cannot hand
    // two people the same position on PostgreSQL (SQLite already serialises transactions).
    await trx.execute('UPDATE events SET registered_count = registered_count WHERE id = $1', [eventId]);
  }
  const maxRow = status === 'WAITLISTED'
    ? await trx.queryOne<{ max_pos: number | null }>(
      `SELECT MAX(waitlist_position) as max_pos FROM registrations WHERE event_id = $1 AND status = 'WAITLISTED'`,
      [eventId])
    : null;
  const position = status === 'WAITLISTED' ? (maxRow?.max_pos ?? 0) + 1 : null;
  await trx.execute(
    `INSERT INTO registrations (id, event_id, user_id, ticket_code, status, waitlist_position, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (event_id, user_id) DO UPDATE SET ticket_code = excluded.ticket_code, status = excluded.status,
       waitlist_position = excluded.waitlist_position, created_at = excluded.created_at`,
    [uuidv4(), eventId, userId, ticketCode, status, position, nowIso()]
  );
  const row = await trx.queryOne<{ id: string }>('SELECT id FROM registrations WHERE event_id = $1 AND user_id = $2', [eventId, userId]);
  return { id: row!.id, ticketCode, position };
}

/** 1-based queue position: number of WAITLISTED rows at or ahead of this one. */
async function queuePosition(trx: DbClient, eventId: string, position: number): Promise<number> {
  const row = await trx.queryOne<{ n: number }>(
    `SELECT COUNT(*) as n FROM registrations WHERE event_id = $1 AND status = 'WAITLISTED' AND waitlist_position <= $2`,
    [eventId, position]
  );
  return Number(row?.n ?? 1);
}

async function registerInTx(trx: DbClient, eventId: string, userId: string): Promise<RegisterResult> {
  const event = await trx.queryOne<EventWindow>(
    'SELECT id, status, start_time, registration_deadline FROM events WHERE id = $1', [eventId]);
  if (!event) throw new HttpError(404, 'Event not found');
  assertOpenForRegistration(event, Date.now());

  const existing = await trx.queryOne<Registration>(
    'SELECT status FROM registrations WHERE event_id = $1 AND user_id = $2', [eventId, userId]);
  const conflict = existing ? ACTIVE_CONFLICTS[existing.status] : undefined;
  if (conflict) throw new HttpError(409, conflict);

  if (await takeSeat(trx, eventId)) {
    const reg = await upsertRegistration(trx, eventId, userId, 'CONFIRMED');
    return { status: 'CONFIRMED', ticketCode: reg.ticketCode, registrationId: reg.id, message: 'Registration confirmed successfully' };
  }
  const reg = await upsertRegistration(trx, eventId, userId, 'WAITLISTED');
  const waitlistPosition = await queuePosition(trx, eventId, reg.position ?? 0);
  return {
    status: 'WAITLISTED', waitlistPosition, ticketCode: reg.ticketCode, registrationId: reg.id,
    message: `Event capacity reached. You are placed on the waitlist at position #${waitlistPosition}`
  };
}

interface CancelTarget extends Registration {
  readonly event_status: string;
  readonly start_time: string;
  readonly event_title: string;
}

async function promoteNextInLine(trx: DbClient, eventId: string, title: string): Promise<string | null> {
  const next = await trx.queryOne<Registration>(
    `SELECT * FROM registrations WHERE event_id = $1 AND status = 'WAITLISTED' ORDER BY waitlist_position ASC LIMIT 1`,
    [eventId]
  );
  if (!next || !(await takeSeat(trx, eventId))) return null;
  await trx.execute(
    `UPDATE registrations SET status = 'CONFIRMED', waitlist_position = NULL WHERE id = $1 AND status = 'WAITLISTED'`,
    [next.id]
  );
  await trx.execute(
    `INSERT INTO notifications (id, user_id, title, message, link_url, is_read, created_at)
     VALUES ($1, $2, 'Waitlist Promotion Confirmed!', $3, $4, 0, $5)`,
    [uuidv4(), next.user_id, `A seat opened up for "${title}" and your registration is now confirmed.`, `/events/${eventId}`, nowIso()]
  );
  return next.user_id;
}

async function cancelInTx(trx: DbClient, registrationId: string, req: Request): Promise<{ promotedStudent: string | null }> {
  const reg = await trx.queryOne<CancelTarget>(
    `SELECT r.*, e.status as event_status, e.start_time, e.title as event_title
     FROM registrations r JOIN events e ON e.id = r.event_id WHERE r.id = $1`,
    [registrationId]
  );
  if (!reg) throw new HttpError(404, 'Registration record not found');
  if (reg.user_id !== req.user!.userId && req.user!.role !== 'ADMIN') {
    throw new HttpError(403, 'You are not authorized to cancel this registration');
  }
  if (reg.status !== 'CONFIRMED' && reg.status !== 'WAITLISTED') {
    throw new HttpError(400, `A ${reg.status} registration cannot be cancelled`);
  }
  if (reg.event_status !== 'PUBLISHED' || Date.now() >= Date.parse(reg.start_time)) {
    throw new HttpError(400, 'Registrations can only be cancelled for published events before they start');
  }
  const updated = await trx.execute(
    `UPDATE registrations SET status = 'CANCELLED', waitlist_position = NULL WHERE id = $1 AND status = $2`,
    [registrationId, reg.status]
  );
  if (updated.rowCount === 0) throw new HttpError(409, 'Registration changed concurrently');
  if (reg.status !== 'CONFIRMED') return { promotedStudent: null };
  await trx.execute(
    'UPDATE events SET registered_count = registered_count - 1 WHERE id = $1 AND registered_count > 0',
    [reg.event_id]
  );
  return { promotedStudent: await promoteNextInLine(trx, reg.event_id, reg.event_title) };
}

const ROSTER_HEADERS = ['Ticket Code', 'Student Name', 'Student ID', 'Department', 'Email', 'Status', 'Registered At', 'Check In Time'];

interface RosterRow {
  ticket_code: string; full_name: string | null; student_id_number: string | null; department: string | null;
  email: string; registration_status: string; registered_at: string; check_in_time: string | null;
}

export class RegistrationController {
  public static async register(req: Request, res: Response): Promise<void> {
    const eventId = String(req.params.eventId);
    const userId = req.user!.userId;
    const result = await db.transaction((trx) => registerInTx(trx, eventId, userId));
    await logAudit(userId, result.status === 'CONFIRMED' ? 'EVENT_REGISTRATION_CONFIRMED' : 'EVENT_WAITLISTED',
      'registrations', result.registrationId, { eventId, ticketCode: result.ticketCode }, req.ip);
    res.status(result.status === 'CONFIRMED' ? 201 : 200).json(result);
  }

  public static async cancel(req: Request, res: Response): Promise<void> {
    const registrationId = String(req.params.registrationId);
    const result = await db.transaction((trx) => cancelInTx(trx, registrationId, req));
    await logAudit(req.user!.userId, 'EVENT_REGISTRATION_CANCELLED', 'registrations', registrationId, result, req.ip);
    res.json({ message: 'Registration successfully cancelled', promotedWaitlistCandidate: result.promotedStudent !== null });
  }

  public static async getUserRegistrations(req: Request, res: Response): Promise<void> {
    const registrations = await db.query(`
      SELECT r.*,
             e.title as event_title, e.start_time, e.end_time, e.venue, e.status as event_status,
             c.name as club_name, c.logo_url as club_logo_url,
             att.check_in_time, att.method as attendance_method,
             cert.serial_number as certificate_serial
      FROM registrations r
      JOIN events e ON r.event_id = e.id
      JOIN clubs c ON e.club_id = c.id
      LEFT JOIN attendance_records att ON r.id = att.registration_id
      LEFT JOIN certificates cert ON r.event_id = cert.event_id AND r.user_id = cert.user_id
      WHERE r.user_id = $1
      ORDER BY e.start_time DESC
    `, [req.user!.userId]);
    res.json({ registrations });
  }

  public static async getEventRoster(req: Request, res: Response): Promise<void> {
    const eventId = String(req.params.eventId);
    const roster = await db.query<RosterRow>(`
      SELECT r.id as registration_id, r.ticket_code, r.status as registration_status, r.created_at as registered_at,
             u.email, p.full_name, p.student_id_number, p.department, p.batch_year, p.phone_number,
             att.check_in_time, att.method as check_in_method
      FROM registrations r
      JOIN users u ON r.user_id = u.id
      LEFT JOIN student_profiles p ON u.id = p.user_id
      LEFT JOIN attendance_records att ON r.id = att.registration_id
      WHERE r.event_id = $1
      ORDER BY r.created_at ASC
    `, [eventId]);

    if (req.query.format !== 'csv') {
      res.json({ roster });
      return;
    }
    const lines = roster.map((r) => csvRow([r.ticket_code, r.full_name, r.student_id_number, r.department, r.email,
      r.registration_status, r.registered_at, r.check_in_time ?? 'N/A']));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="roster-${eventId.replace(/[^A-Za-z0-9_-]/g, '')}.csv"`);
    res.send([csvRow(ROSTER_HEADERS), ...lines].join('\n') + '\n');
  }
}
