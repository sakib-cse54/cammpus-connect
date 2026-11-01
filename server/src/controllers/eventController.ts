import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db, DbClient } from '../db/index.js';
import { logAudit } from '../middleware/audit.js';
import { Event, EventStatus } from '../types/index.js';
import { HttpError, validate } from '../utils/http.js';
import { nowIso } from '../utils/time.js';
import { getClubAccess } from '../services/clubAccess.js';
import { loadVenue } from '../services/scheduleService.js';
import { enforceSchedule, ScheduleGuardResult } from '../services/scheduleGuard.js';
import { AuthTokenPayload } from '../types/index.js';
import {
  applyTransition,
  EDITABLE_EVENT_STATUSES,
  PUBLIC_EVENT_STATUSES
} from '../services/eventLifecycle.js';
import {
  cancelEventSchema,
  eventTimesSchema,
  createEventSchema,
  eventListQuerySchema,
  merged,
  normalizeTimes,
  reviewEventSchema,
  submitEventSchema,
  updateEventSchema,
  UpdateEventInput,
  EventTimes
} from '../validation/eventSchemas.js';
import { ScheduleCheckInput } from '../services/scheduleService.js';
import { getEventOutcomes, replaceEventOutcomes } from '../services/outcomeService.js';
import { PoTag } from '../validation/outcomeSchemas.js';

const EVENT_DETAIL_SQL = `
  SELECT e.*,
         c.name as club_name, c.slug as club_slug, c.category as club_category, c.logo_url as club_logo_url,
         p_adv.full_name as advisor_name,
         (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status = 'WAITLISTED') as waitlist_count
  FROM events e
  JOIN clubs c ON e.club_id = c.id
  LEFT JOIN users u_adv ON c.faculty_advisor_id = u_adv.id
  LEFT JOIN student_profiles p_adv ON u_adv.id = p_adv.user_id
  WHERE e.id = $1`;

const isPublicStatus = (s: string): boolean => (PUBLIC_EVENT_STATUSES as readonly string[]).includes(s);

interface OverrideLog {
  readonly user: AuthTokenPayload;
  readonly eventId: string;
  readonly reason?: string;
  readonly guard: ScheduleGuardResult;
  readonly ip?: string;
}

/** Audit-logs schedule errors bypassed by an ADMIN/advisor override (call outside transactions). */
async function logOverride(o: OverrideLog): Promise<void> {
  if (o.guard.overridden.length === 0) return;
  await logAudit(o.user.userId, 'EVENT_SCHEDULE_OVERRIDE', 'events', o.eventId, {
    reason: o.reason, issues: o.guard.overridden.map((i) => ({ code: i.code, message: i.message }))
  }, o.ip);
}

/** Resolves the free-text venue from venue_id (back compat: venue text mirrors the venue name). */
async function venueText(venueId: string | null | undefined, fallback: string | undefined): Promise<string | undefined> {
  return venueId ? (await loadVenue(venueId)).name : fallback;
}

async function loadEvent(id: string, client: DbClient = db): Promise<Event> {
  const event = await client.queryOne<Event>('SELECT * FROM events WHERE id = $1', [id]);
  if (!event) throw new HttpError(404, 'Event not found');
  return event;
}

export class EventController {
  /** Public listing: only PUBLISHED (default), COMPLETED or CANCELLED events. */
  public static async getEvents(req: Request, res: Response): Promise<void> {
    const q = validate(eventListQuerySchema, req.query);
    const conditions: string[] = ['e.status = $1'];
    const params: unknown[] = [q.status ?? 'PUBLISHED'];
    const add = (sql: string, value: unknown): void => {
      params.push(value);
      conditions.push(sql.replace(/\?/g, `$${params.length}`));
    };
    if (q.category) add('c.category = ?', q.category);
    if (q.club_id) add('e.club_id = ?', q.club_id);
    if (q.search) add('(LOWER(e.title) LIKE LOWER(?) OR LOWER(e.description) LIKE LOWER(?) OR LOWER(e.venue) LIKE LOWER(?))', `%${q.search}%`);

    const events = await db.query(`
      SELECT e.*,
             c.name as club_name, c.slug as club_slug, c.category as club_category, c.logo_url as club_logo_url,
             p.full_name as creator_name
      FROM events e
      JOIN clubs c ON e.club_id = c.id
      LEFT JOIN users u ON e.created_by = u.id
      LEFT JOIN student_profiles p ON u.id = p.user_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY e.start_time ASC
    `, params);
    res.json({ events });
  }

  /** Non-public events are visible only to the hosting club's managers (404 otherwise). */
  public static async getEventById(req: Request, res: Response): Promise<void> {
    const id = String(req.params.id);
    const event = await db.queryOne<{ club_id: string; status: string }>(EVENT_DETAIL_SQL, [id]);
    if (!event) throw new HttpError(404, 'Event not found');
    if (!isPublicStatus(event.status)) {
      const access = req.user ? await getClubAccess(req.user, event.club_id) : null;
      if (!access) throw new HttpError(404, 'Event not found');
    }
    const userRegistration = req.user
      ? await db.queryOne('SELECT * FROM registrations WHERE event_id = $1 AND user_id = $2', [id, req.user.userId])
      : null;
    res.json({ event, userRegistration });
  }

  public static async createDraftEvent(req: Request, res: Response): Promise<void> {
    const input = normalizeTimes(validate(createEventSchema, req.body));
    const user = req.user!;
    const club = await db.queryOne<{ id: string }>('SELECT id FROM clubs WHERE id = $1', [input.club_id]);
    if (!club) throw new HttpError(404, 'Club not found');
    const access = await getClubAccess(user, input.club_id);
    if (!access) throw new HttpError(403, 'Forbidden: You are not an authorized executive of this club');

    const venue = (await venueText(input.venue_id, input.venue)) ?? '';
    const guard = await enforceSchedule({
      user, clubId: input.club_id, overrideReason: input.override_reason,
      check: { start: input.start_time, end: input.end_time, venueId: input.venue_id, capacity: input.capacity }
    });
    const eventId = uuidv4();
    await db.transaction(async (trx) => {
      await trx.execute(
      `INSERT INTO events (
        id, club_id, title, description, venue, start_time, end_time,
        capacity, registered_count, registration_deadline, status,
        requires_feedback_for_cert, created_by, venue_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, $9, 'DRAFT', $10, $11, $12)`,
      [eventId, input.club_id, input.title, input.description, venue, input.start_time, input.end_time,
        input.capacity, input.registration_deadline, input.requires_feedback_for_cert ? 1 : 0, user.userId, input.venue_id ?? null]
      );
      if (input.po_tags) await replaceEventOutcomes(trx, eventId, input.po_tags, user.userId);
    });
    await logAudit(user.userId, 'EVENT_DRAFT_CREATED', 'events', eventId, { title: input.title, club_id: input.club_id }, req.ip);
    await logOverride({ user, eventId, reason: input.override_reason, guard, ip: req.ip });
    res.status(201).json({ message: 'Event drafted successfully', eventId, schedule_warnings: guard.warnings });
  }

  /** PATCH /events/:id: edits a DRAFT or REJECTED event. */
  public static async updateEvent(req: Request, res: Response): Promise<void> {
    const id = String(req.params.id);
    const patch = normalizeTimes(validate(updateEventSchema, req.body));
    const event = await loadEvent(id);
    if (!EDITABLE_EVENT_STATUSES.includes(event.status)) {
      throw new HttpError(409, `Only DRAFT or REJECTED events can be edited (current: ${event.status})`);
    }
    const times = validate(eventTimesSchema, merged(event, patch));
    const venue = await venueText(patch.venue_id, patch.venue);
    const guard = await guardPatch(req.user!, event, patch, times);

    const updated = await db.transaction(async (trx) => {
      const ok = await persistEventPatch(trx, id, event.status, { ...patch, ...(venue ? { venue } : {}) });
      if (ok && patch.po_tags) await replaceEventOutcomes(trx, id, patch.po_tags, req.user!.userId);
      return ok;
    });
    if (!updated) throw new HttpError(409, 'Event status changed concurrently; reload and retry');
    await logAudit(req.user!.userId, 'EVENT_UPDATED', 'events', id, { fields: Object.keys(patch) }, req.ip);
    await logOverride({ user: req.user!, eventId: id, reason: patch.override_reason, guard, ip: req.ip });
    res.json({ message: 'Event updated', event: await loadEvent(id), po_tags: await getEventOutcomes(id), schedule_warnings: guard.warnings });
  }

  public static async submitForApproval(req: Request, res: Response): Promise<void> {
    const id = String(req.params.id);
    const { override_reason } = validate(submitEventSchema, req.body ?? {});
    const event = await loadEvent(id);
    const guard = await enforceSchedule({
      user: req.user!, clubId: event.club_id, overrideReason: override_reason, check: eventCheck(event)
    });
    await applyTransition(db, { eventId: id, from: event.status, to: 'PENDING_APPROVAL', set: { advisor_remarks: null } });
    await logAudit(req.user!.userId, 'EVENT_SUBMITTED_FOR_REVIEW', 'events', id, undefined, req.ip);
    await logOverride({ user: req.user!, eventId: id, reason: override_reason, guard, ip: req.ip });
    res.json({ message: 'Event submitted for faculty advisor review', schedule_warnings: guard.warnings });
  }

  /** Only the hosting club's advisor (or ADMIN, enforced by the route) may review. */
  public static async reviewEvent(req: Request, res: Response): Promise<void> {
    const id = String(req.params.id);
    const { decision, remarks, override_reason, po_tags } = validate(reviewEventSchema, req.body);
    const to: EventStatus = decision === 'APPROVED' ? 'PUBLISHED' : 'REJECTED';
    // Re-check inside the write transaction so two overlapping approvals cannot both win the venue.
    const guard = await db.transaction(async (trx): Promise<ScheduleGuardResult | null> => {
      const event = await loadEvent(id, trx);
      if (event.status !== 'PENDING_APPROVAL') {
        throw new HttpError(409, `Only events pending approval can be reviewed (current: ${event.status})`);
      }
      const checked = to === 'PUBLISHED'
        ? await enforceSchedule({ user: req.user!, clubId: event.club_id, overrideReason: override_reason, check: eventCheck(event), client: trx })
        : null;
      if (to === 'PUBLISHED') await applyReviewTags(trx, id, po_tags, req.user!.userId);
      await applyTransition(trx, {
        eventId: id, from: 'PENDING_APPROVAL', to,
        set: { advisor_remarks: remarks || 'Approved for campus publication' }
      });
      return checked;
    });
    await logAudit(req.user!.userId, `EVENT_${decision}`, 'events', id, { decision, remarks }, req.ip);
    if (guard) await logOverride({ user: req.user!, eventId: id, reason: override_reason, guard, ip: req.ip });
    res.json({
      message: `Event proposal has been ${decision.toLowerCase()} and is now ${to.toLowerCase()}`,
      schedule_warnings: guard?.warnings ?? []
    });
  }

  /** Cancels the event, all active registrations, and notifies registrants atomically. */
  public static async cancelEvent(req: Request, res: Response): Promise<void> {
    const id = String(req.params.id);
    const { reason } = validate(cancelEventSchema, req.body);
    const notified = await db.transaction(async (trx) => {
      const event = await loadEvent(id, trx);
      assertCancellable(event);
      await applyTransition(trx, { eventId: id, from: event.status, to: 'CANCELLED', set: { cancellation_reason: reason } });
      return cancelRegistrationsAndNotify(trx, event, reason);
    });
    await logAudit(req.user!.userId, 'EVENT_CANCELLED', 'events', id, { reason, notified }, req.ip);
    res.json({ message: 'Event cancelled successfully', registrations_cancelled: notified });
  }

  /** POST /events/:id/complete: PUBLISHED events whose end_time has passed. */
  public static async completeEvent(req: Request, res: Response): Promise<void> {
    const id = String(req.params.id);
    const event = await loadEvent(id);
    if (event.status !== 'PUBLISHED') {
      throw new HttpError(409, `Only PUBLISHED events can be completed (current: ${event.status})`);
    }
    if (Date.now() < Date.parse(event.end_time)) {
      throw new HttpError(400, 'Event cannot be completed before its end time');
    }
    await applyTransition(db, { eventId: id, from: 'PUBLISHED', to: 'COMPLETED' });
    await logAudit(req.user!.userId, 'EVENT_COMPLETED', 'events', id, undefined, req.ip);
    res.json({ message: 'Event marked as completed' });
  }

  public static async getPendingApprovalEvents(req: Request, res: Response): Promise<void> {
    const isAdvisor = req.user?.role === 'FACULTY_ADVISOR';
    const events = await db.query(`
      SELECT e.*, c.name as club_name, c.slug as club_slug, p.full_name as creator_name
      FROM events e
      JOIN clubs c ON e.club_id = c.id
      LEFT JOIN users u ON e.created_by = u.id
      LEFT JOIN student_profiles p ON u.id = p.user_id
      WHERE e.status = 'PENDING_APPROVAL' ${isAdvisor ? 'AND c.faculty_advisor_id = $1' : ''}
      ORDER BY e.start_time ASC
    `, isAdvisor ? [req.user!.userId] : []);
    res.json({ events });
  }
}

/**
 * On approval the advisor may set/override PO tags; the event must end up
 * with at least one tag (BAETE OBE evidence requirement).
 */
async function applyReviewTags(trx: DbClient, eventId: string, tags: readonly PoTag[] | undefined, userId: string): Promise<void> {
  if (tags && tags.length > 0) {
    await replaceEventOutcomes(trx, eventId, tags, userId);
    return;
  }
  if ((await getEventOutcomes(eventId, trx)).length === 0) {
    throw new HttpError(400, 'Validation failed', [{ path: 'po_tags', message: 'At least one BAETE PO tag is required to approve an event' }], 'PO_TAGS_REQUIRED');
  }
}

const PATCH_COLUMNS = [
  'title', 'description', 'venue', 'venue_id', 'start_time', 'end_time', 'registration_deadline', 'capacity', 'requires_feedback_for_cert'
] as const;

function eventCheck(event: Event): ScheduleCheckInput {
  return { start: event.start_time, end: event.end_time, venueId: event.venue_id, capacity: event.capacity, excludeEventId: event.id };
}

const SCHEDULE_FIELDS = ['start_time', 'end_time', 'venue_id', 'capacity'] as const;

/** Re-runs the schedule check when a patch touches time, venue or capacity. */
async function guardPatch(user: AuthTokenPayload, event: Event, patch: UpdateEventInput, times: EventTimes): Promise<ScheduleGuardResult> {
  if (!SCHEDULE_FIELDS.some((f) => patch[f] !== undefined)) return { warnings: [], overridden: [] };
  return enforceSchedule({
    user, clubId: event.club_id, overrideReason: patch.override_reason,
    check: {
      ...eventCheck(event), start: times.start_time, end: times.end_time,
      venueId: patch.venue_id !== undefined ? patch.venue_id : event.venue_id,
      capacity: patch.capacity ?? event.capacity
    }
  });
}

async function persistEventPatch(client: DbClient, id: string, status: EventStatus, patch: UpdateEventInput): Promise<boolean> {
  const entries = PATCH_COLUMNS
    .filter((col) => patch[col] !== undefined)
    .map((col): [string, unknown] => [col, col === 'requires_feedback_for_cert' ? (patch[col] ? 1 : 0) : patch[col]]);
  // A tags-only patch still asserts the status has not changed concurrently.
  if (entries.length === 0) {
    return Boolean(await client.queryOne('SELECT id FROM events WHERE id = $1 AND status = $2', [id, status]));
  }
  const assignments = entries.map(([col], i) => `${col} = $${i + 3}`).join(', ');
  const result = await client.execute(
    `UPDATE events SET ${assignments} WHERE id = $1 AND status = $2`,
    [id, status, ...entries.map(([, v]) => v)]
  );
  return result.rowCount > 0;
}

/**
 * A PUBLISHED event cannot be cancelled once it has started: attendance and
 * certificates may already exist, so it must be completed instead.
 */
function assertCancellable(event: Event, nowMs: number = Date.now()): void {
  if (event.status === 'PUBLISHED' && nowMs >= Date.parse(event.start_time)) {
    throw new HttpError(409, 'Event has already started; mark it COMPLETED instead of cancelling', undefined, 'EVENT_ALREADY_STARTED');
  }
}

async function cancelRegistrationsAndNotify(trx: DbClient, event: Event, reason: string): Promise<number> {
  const active = await trx.query<{ id: string; user_id: string }>(
    `SELECT id, user_id FROM registrations WHERE event_id = $1 AND status IN ('CONFIRMED', 'WAITLISTED')`,
    [event.id]
  );
  await trx.execute(
    `UPDATE registrations SET status = 'CANCELLED', waitlist_position = NULL
     WHERE event_id = $1 AND status IN ('CONFIRMED', 'WAITLISTED')`,
    [event.id]
  );
  await trx.execute('UPDATE events SET registered_count = 0 WHERE id = $1', [event.id]);
  const createdAt = nowIso();
  for (const r of active) {
    await trx.execute(
      `INSERT INTO notifications (id, user_id, title, message, link_url, is_read, created_at)
       VALUES ($1, $2, $3, $4, $5, 0, $6)`,
      [uuidv4(), r.user_id, `Event cancelled: ${event.title}`.substring(0, 200),
        `This event has been cancelled. Reason: ${reason}`.substring(0, 500), `/events/${event.id}`, createdAt]
    );
  }
  return active.length;
}
