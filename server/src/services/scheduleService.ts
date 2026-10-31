import { db, DbClient } from '../db/index.js';
import { HttpError } from '../utils/http.js';
import {
  BlackoutWindow, BookedEvent, evaluateSchedule, findFreeSlots, FreeSlot, dhakaInstant,
  ScheduleResult, SemesterRange, toInterval, VenueInfo
} from './scheduleRules.js';

export * from './scheduleRules.js';

/** Event statuses that hold a venue booking. */
export const VENUE_HOLDING_STATUSES = ['PUBLISHED', 'PENDING_APPROVAL'] as const;

export interface ScheduleCheckInput {
  readonly start: string;
  readonly end: string;
  readonly venueId?: string | null;
  readonly capacity?: number;
  readonly excludeEventId?: string;
}

interface VenueRow {
  id: string; name: string; capacity: number; is_active: number | boolean;
}

interface BlackoutRow extends Omit<BlackoutWindow, 'tentative'> {
  tentative: number | boolean;
}

/** Loads an active-or-inactive venue by id; 404 when it does not exist. */
export async function loadVenue(venueId: string, client: DbClient = db): Promise<VenueInfo> {
  const row = await client.queryOne<VenueRow>('SELECT id, name, capacity, is_active FROM venues WHERE id = $1', [venueId]);
  if (!row) throw new HttpError(404, 'Venue not found', [{ path: 'venue_id', message: 'Unknown venue' }], 'VENUE_NOT_FOUND');
  return { id: row.id, name: row.name, capacity: Number(row.capacity), is_active: Boolean(row.is_active) };
}

async function loadBlackouts(client: DbClient, start: string, end: string): Promise<BlackoutWindow[]> {
  const rows = await client.query<BlackoutRow>(
    `SELECT id, kind, title_en, starts_at, ends_at, tentative, severity FROM calendar_blackouts
     WHERE starts_at < $2 AND ends_at > $1`,
    [start, end]
  );
  return rows.map((r) => ({ ...r, tentative: Boolean(r.tentative) }));
}

async function loadVenueEvents(client: DbClient, venueId: string, start: string, end: string): Promise<BookedEvent[]> {
  return client.query<BookedEvent>(
    `SELECT id, title, start_time, end_time FROM events
     WHERE venue_id = $1 AND status IN ($2, $3) AND start_time < $5 AND end_time > $4`,
    [venueId, ...VENUE_HOLDING_STATUSES, start, end]
  );
}

/** DB-backed schedule check (thin loader around evaluateSchedule). Pass a trx to check inside a transaction. */
export async function checkSchedule(input: ScheduleCheckInput, client: DbClient = db): Promise<ScheduleResult> {
  const start = new Date(input.start).toISOString();
  const end = new Date(input.end).toISOString();
  const venue = input.venueId ? await loadVenue(input.venueId, client) : null;
  const [blackouts, semesters, venueEvents] = await Promise.all([
    loadBlackouts(client, start, end),
    client.query<SemesterRange>('SELECT id, name, start_date, end_date FROM semesters'),
    venue ? loadVenueEvents(client, venue.id, start, end) : Promise.resolve([])
  ]);
  return evaluateSchedule(
    { start, end, capacity: input.capacity, excludeEventId: input.excludeEventId },
    { blackouts, semesters, venue, venueEvents }
  );
}

/** Up to 5 free slots for a venue on a Dhaka calendar day, 08:00 to 20:00. */
export async function suggestFreeSlots(venueId: string, date: string, durationMinutes: number, client: DbClient = db): Promise<FreeSlot[]> {
  await loadVenue(venueId, client);
  const dayStart = new Date(dhakaInstant(date, 0)).toISOString();
  const dayEnd = new Date(dhakaInstant(date, 24)).toISOString();
  const [events, blackouts] = await Promise.all([
    loadVenueEvents(client, venueId, dayStart, dayEnd),
    loadBlackouts(client, dayStart, dayEnd)
  ]);
  const busy = [
    ...events.map((e) => toInterval(e.start_time, e.end_time)),
    ...blackouts.filter((b) => b.severity === 'BLOCK').map((b) => toInterval(b.starts_at, b.ends_at))
  ];
  return findFreeSlots({ date, durationMinutes, busy, now: Date.now() });
}
