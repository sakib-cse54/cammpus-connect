import { v4 as uuidv4 } from 'uuid';
import { db, DbClient } from '../db/index.js';
import { Registration } from '../types/index.js';
import { haversineMeters, isOutOfRange } from '../utils/geo.js';
import { addMinutes, nowIso } from '../utils/time.js';
import { HttpError } from '../utils/http.js';

/** Check-in opens this many minutes before start_time and closes at end_time. */
export const CHECK_IN_OPENS_MINUTES_BEFORE = 30;

export type CheckInMethod = 'QR_SCAN' | 'MANUAL_OVERRIDE' | 'OFFLINE_BATCH';
export type CheckInFlag = 'OUT_OF_RANGE' | 'SHARED_DEVICE';

export interface GeoReading {
  readonly lat: number;
  readonly lng: number;
  readonly accuracy?: number;
}

export interface GeoResult {
  readonly distanceM: number;
  readonly outOfRange: boolean;
}

export interface CheckInOptions {
  readonly method: CheckInMethod;
  readonly recordedBy: string;
  readonly deviceId?: string;
  readonly geo?: GeoResult;
  readonly checkInTime?: string;
}

export interface CheckInResult {
  readonly attendanceId: string;
  readonly flags: readonly CheckInFlag[];
}

interface EventWindow {
  readonly status: string;
  readonly start_time: string;
  readonly end_time: string;
}

export async function loadEventWindow(eventId: string): Promise<EventWindow> {
  const event = await db.queryOne<EventWindow>('SELECT status, start_time, end_time FROM events WHERE id = $1', [eventId]);
  if (!event) throw new HttpError(404, 'Event not found');
  return event;
}

/** True when `at` (epoch ms) lies within [start - 30 min, end]. */
export function isWithinWindow(event: EventWindow, at: number): boolean {
  const opens = addMinutes(event.start_time, -CHECK_IN_OPENS_MINUTES_BEFORE).getTime();
  return at >= opens && at <= Date.parse(event.end_time);
}

/** Throws unless the event is PUBLISHED and now is within the check-in window. */
export async function assertCheckInWindow(eventId: string): Promise<void> {
  const event = await loadEventWindow(eventId);
  if (event.status !== 'PUBLISHED') {
    throw new HttpError(400, `Check-in is only available for published events (status: ${event.status})`);
  }
  if (!isWithinWindow(event, Date.now())) {
    throw new HttpError(400, 'Check-in is only open from 30 minutes before the start until the end of the event');
  }
}

/** Distance to the event's venue, or undefined when no venue coordinates/radius exist. */
export async function evaluateGeofence(eventId: string, reading: GeoReading | undefined): Promise<GeoResult | undefined> {
  if (!reading) return undefined;
  const venue = await db.queryOne<{ latitude: number | null; longitude: number | null; radius_m: number | null }>(
    `SELECT v.latitude, v.longitude, v.radius_m FROM events e JOIN venues v ON v.id = e.venue_id WHERE e.id = $1`, [eventId]);
  if (!venue || venue.latitude === null || venue.longitude === null || venue.radius_m === null) return undefined;
  const distanceM = haversineMeters({ lat: venue.latitude, lng: venue.longitude }, reading);
  return { distanceM: Math.round(distanceM), outOfRange: isOutOfRange(distanceM, venue.radius_m, reading.accuracy) };
}

async function sharedDevice(trx: DbClient, eventId: string, userId: string, deviceId: string | undefined): Promise<boolean> {
  if (!deviceId) return false;
  const other = await trx.queryOne(
    'SELECT id FROM attendance_records WHERE event_id = $1 AND device_id = $2 AND user_id <> $3', [eventId, deviceId, userId]);
  return Boolean(other);
}

export function serializeFlags(flags: readonly CheckInFlag[]): string | null {
  return flags.length > 0 ? flags.join(',') : null;
}

export function parseFlags(raw: string | null | undefined): CheckInFlag[] {
  return raw ? (raw.split(',').filter(Boolean) as CheckInFlag[]) : [];
}

async function assertCheckInnable(reg: Registration | null): Promise<Registration> {
  if (!reg) throw new HttpError(403, 'No registration record found for this student on this event');
  if (reg.status === 'ATTENDED') throw new HttpError(409, 'Attendance already recorded for this registration');
  if (reg.status !== 'CONFIRMED') throw new HttpError(403, `A ${reg.status} registration cannot check in`);
  return reg;
}

/** Records attendance for a CONFIRMED registration atomically; 409 on duplicates. */
export async function recordAttendance(eventId: string, userId: string, opts: CheckInOptions): Promise<CheckInResult> {
  return db.transaction(async (trx: DbClient) => {
    const reg = await assertCheckInnable(await trx.queryOne<Registration>(
      'SELECT id, status FROM registrations WHERE event_id = $1 AND user_id = $2', [eventId, userId]));
    const flags: CheckInFlag[] = [
      ...(opts.geo?.outOfRange ? ['OUT_OF_RANGE' as const] : []),
      ...((await sharedDevice(trx, eventId, userId, opts.deviceId)) ? ['SHARED_DEVICE' as const] : [])
    ];
    const attendanceId = uuidv4();
    const inserted = await trx.execute(
      `INSERT INTO attendance_records
         (id, event_id, user_id, registration_id, check_in_time, method, recorded_by, flags, distance_m, device_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (registration_id) DO NOTHING`,
      [attendanceId, eventId, userId, reg.id, opts.checkInTime ?? nowIso(), opts.method, opts.recordedBy,
        serializeFlags(flags), opts.geo?.distanceM ?? null, opts.deviceId ?? null]
    );
    if (inserted.rowCount === 0) throw new HttpError(409, 'Attendance already recorded for this registration');
    await trx.execute(`UPDATE registrations SET status = 'ATTENDED' WHERE id = $1 AND status = 'CONFIRMED'`, [reg.id]);
    return { attendanceId, flags };
  });
}
