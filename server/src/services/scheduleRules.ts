/**
 * Pure scheduling rules (no I/O): blackout windows, venue double-booking,
 * venue capacity, semester bounds and free-slot search. All instants are
 * ISO 8601 strings; calendar days are YYYY-MM-DD in Asia/Dhaka (UTC+06:00, no DST).
 */

export type ScheduleIssueCode =
  | 'BLACKOUT_BLOCK'
  | 'BLACKOUT_WARN'
  | 'VENUE_CONFLICT'
  | 'VENUE_CAPACITY'
  | 'VENUE_INACTIVE'
  | 'OUTSIDE_SEMESTER';

export interface ScheduleIssue {
  readonly code: ScheduleIssueCode;
  readonly message: string;
  readonly ref?: { readonly id: string; readonly title: string; readonly starts_at: string; readonly ends_at: string };
  /** Booked window only, used instead of `ref` when the viewer may not see the conflicting event. */
  readonly window?: { readonly starts_at: string; readonly ends_at: string };
}

export interface ScheduleResult {
  readonly errors: readonly ScheduleIssue[];
  readonly warnings: readonly ScheduleIssue[];
}

export type BlackoutKind = 'FINAL_EXAM' | 'MIDTERM' | 'HOLIDAY' | 'NATIONAL_DAY';
export type BlackoutSeverity = 'BLOCK' | 'WARN';

export interface BlackoutWindow {
  readonly id: string;
  readonly kind: BlackoutKind;
  readonly title_en: string;
  readonly starts_at: string;
  readonly ends_at: string;
  readonly tentative: boolean;
  readonly severity: BlackoutSeverity;
}

export interface SemesterRange {
  readonly id: string;
  readonly name: string;
  readonly start_date: string;
  readonly end_date: string;
}

export interface VenueInfo {
  readonly id: string;
  readonly name: string;
  readonly capacity: number;
  readonly is_active: boolean;
}

export interface BookedEvent {
  readonly id: string;
  readonly title: string;
  readonly start_time: string;
  readonly end_time: string;
}

export interface ScheduleProposal {
  readonly start: string;
  readonly end: string;
  readonly capacity?: number;
  readonly excludeEventId?: string;
}

export interface ScheduleData {
  readonly blackouts: readonly BlackoutWindow[];
  readonly semesters: readonly SemesterRange[];
  readonly venue: VenueInfo | null;
  readonly venueEvents: readonly BookedEvent[];
}

export interface Interval {
  readonly start: number;
  readonly end: number;
}

const MS_PER_MINUTE = 60_000;
const DHAKA_OFFSET_MS = 6 * 60 * MS_PER_MINUTE;

/** Half-open overlap: [aStart, aEnd) and [bStart, bEnd) share time iff aStart < bEnd AND aEnd > bStart. */
export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && a.end > b.start;
}

export function toInterval(start: string, end: string): Interval {
  return { start: Date.parse(start), end: Date.parse(end) };
}

/** The Asia/Dhaka calendar day (YYYY-MM-DD) of an instant. */
export function dhakaDate(instant: string | number): string {
  const ms = typeof instant === 'number' ? instant : Date.parse(instant);
  return new Date(ms + DHAKA_OFFSET_MS).toISOString().slice(0, 10);
}

/** The instant of a Dhaka wall-clock time on a YYYY-MM-DD day. */
export function dhakaInstant(date: string, hour: number, minute = 0): number {
  return Date.parse(`${date}T00:00:00.000Z`) - DHAKA_OFFSET_MS + (hour * 60 + minute) * MS_PER_MINUTE;
}

function blackoutIssues(range: Interval, blackouts: readonly BlackoutWindow[]): ScheduleIssue[] {
  return blackouts
    .filter((b) => overlaps(range, toInterval(b.starts_at, b.ends_at)))
    .map((b): ScheduleIssue => ({
      code: b.severity === 'BLOCK' ? 'BLACKOUT_BLOCK' : 'BLACKOUT_WARN',
      message: `Overlaps ${b.kind.replace('_', ' ').toLowerCase()} period "${b.title_en}"${b.tentative ? ' (tentative dates)' : ''}`,
      ref: { id: b.id, title: b.title_en, starts_at: b.starts_at, ends_at: b.ends_at }
    }));
}

function venueIssues(range: Interval, p: ScheduleProposal, data: ScheduleData): ScheduleIssue[] {
  const venue = data.venue;
  if (!venue) return [];
  const conflicts = data.venueEvents
    .filter((e) => e.id !== p.excludeEventId && overlaps(range, toInterval(e.start_time, e.end_time)))
    .map((e): ScheduleIssue => ({
      code: 'VENUE_CONFLICT',
      message: `${venue.name} is already booked for "${e.title}"`,
      ref: { id: e.id, title: e.title, starts_at: e.start_time, ends_at: e.end_time }
    }));
  const inactive: ScheduleIssue[] = venue.is_active ? [] : [{ code: 'VENUE_INACTIVE', message: `${venue.name} is not available for booking` }];
  const tooSmall: ScheduleIssue[] = p.capacity !== undefined && p.capacity > venue.capacity
    ? [{ code: 'VENUE_CAPACITY', message: `Capacity ${p.capacity} exceeds ${venue.name} capacity of ${venue.capacity}` }]
    : [];
  return [...inactive, ...conflicts, ...tooSmall];
}

function semesterIssues(p: ScheduleProposal, semesters: readonly SemesterRange[]): ScheduleIssue[] {
  if (semesters.length === 0) return [];
  const startDay = dhakaDate(p.start);
  const endDay = dhakaDate(p.end);
  const inside = semesters.some((s) => s.start_date <= startDay && endDay <= s.end_date);
  return inside ? [] : [{ code: 'OUTSIDE_SEMESTER', message: 'Event falls outside the dates of any academic semester' }];
}

const WARNING_CODES: readonly ScheduleIssueCode[] = ['BLACKOUT_WARN', 'OUTSIDE_SEMESTER'];

/** Evaluates a proposed slot against calendar and venue data. */
export function evaluateSchedule(p: ScheduleProposal, data: ScheduleData): ScheduleResult {
  const range = toInterval(p.start, p.end);
  const all = [
    ...blackoutIssues(range, data.blackouts),
    ...venueIssues(range, p, data),
    ...semesterIssues(p, data.semesters)
  ];
  return {
    errors: all.filter((i) => !WARNING_CODES.includes(i.code)),
    warnings: all.filter((i) => WARNING_CODES.includes(i.code))
  };
}

export interface FreeSlotQuery {
  readonly date: string;
  readonly durationMinutes: number;
  readonly busy: readonly Interval[];
  readonly now?: number;
  readonly stepMinutes?: number;
  readonly limit?: number;
  readonly dayStartHour?: number;
  readonly dayEndHour?: number;
}

export interface FreeSlot {
  readonly start: string;
  readonly end: string;
}

/** Up to `limit` (default 5) non-overlapping-with-busy slots between 08:00 and 20:00 Dhaka. */
export function findFreeSlots(q: FreeSlotQuery): FreeSlot[] {
  const step = (q.stepMinutes ?? 30) * MS_PER_MINUTE;
  const duration = q.durationMinutes * MS_PER_MINUTE;
  const dayEnd = dhakaInstant(q.date, q.dayEndHour ?? 20);
  const limit = q.limit ?? 5;
  const slots: FreeSlot[] = [];
  for (let s = dhakaInstant(q.date, q.dayStartHour ?? 8); s + duration <= dayEnd && slots.length < limit; s += step) {
    const candidate = { start: s, end: s + duration };
    const inPast = q.now !== undefined && s < q.now;
    if (!inPast && !q.busy.some((b) => overlaps(candidate, b))) {
      slots.push({ start: new Date(s).toISOString(), end: new Date(s + duration).toISOString() });
    }
  }
  return slots;
}
