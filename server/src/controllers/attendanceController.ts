import { Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { QrService } from '../services/qrService.js';
import { logAudit } from '../middleware/audit.js';
import {
  assertCheckInWindow, evaluateGeofence, parseFlags, recordAttendance
} from '../services/checkInService.js';
import { applyOfflineBatch } from '../services/offlineBatch.js';
import { isoDateTimeSchema } from '../utils/time.js';
import { HttpError, validate } from '../utils/http.js';
import { env } from '../config/env.js';

export { CHECK_IN_OPENS_MINUTES_BEFORE } from '../services/checkInService.js';

const ROTATION_SECONDS = 20;

const scanSchema = z.object({
  token: z.string().min(1).max(200).optional(),
  short_code: z.string().regex(/^\d{6}$/, 'short_code must be 6 digits').optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  accuracy: z.number().min(0).max(100000).optional()
}).refine((b) => Boolean(b.token) !== Boolean(b.short_code), { message: 'Provide exactly one of token or short_code', path: ['token'] })
  .refine((b) => (b.lat === undefined) === (b.lng === undefined), { message: 'lat and lng must be sent together', path: ['lat'] });

const deviceIdSchema = z.string().uuid();

const manualSchema = z.object({
  student_id_number: z.string().trim().min(1).max(50),
  reason: z.string().trim().min(3).max(500)
});

const batchItemSchema = z.object({
  ticket_code: z.string().trim().min(1).max(100),
  scanned_at: isoDateTimeSchema,
  idempotency_key: z.string().trim().min(1).max(100)
});
const batchSchema = z.union([
  z.array(batchItemSchema).min(1).max(500),
  z.object({ items: z.array(batchItemSchema).min(1).max(500) }).transform((b) => b.items)
]);

/** Optional X-Device-Id header; must be a UUID when present. */
function readDeviceId(req: Request): string | undefined {
  const raw = req.get('X-Device-Id');
  if (raw === undefined || raw === '') return undefined;
  return validate(deviceIdSchema, raw.trim().toLowerCase());
}

function verifyScanCredential(eventId: string, token?: string, shortCode?: string): boolean {
  if (token) return QrService.verifyDynamicToken(token, eventId);
  return shortCode ? QrService.verifyShortCode(shortCode, eventId) : false;
}

export class AttendanceController {
  public static async getLiveQrPass(req: Request, res: Response): Promise<void> {
    const eventId = String(req.params.eventId);
    await assertCheckInWindow(eventId);
    const slot = QrService.getCurrentSlot();
    const token = QrService.generateDynamicToken(eventId, slot);
    const checkinUrl = QrService.buildCheckInUrl(env.PUBLIC_URL || env.CLIENT_URL, eventId, token);
    const qrDataUrl = await QrService.generateQrDataUrl(checkinUrl);
    const nowSeconds = Math.floor(Date.now() / 1000);
    res.json({
      event_id: eventId,
      token,
      short_code: QrService.generateShortCode(eventId, slot),
      checkin_url: checkinUrl,
      qr_data_url: qrDataUrl,
      rotation_interval_seconds: ROTATION_SECONDS,
      expires_in_seconds: ROTATION_SECONDS - (nowSeconds % ROTATION_SECONDS)
    });
  }

  /** The scanning student always checks in themselves; any body student_id is ignored. */
  public static async checkInWithQr(req: Request, res: Response): Promise<void> {
    const eventId = String(req.params.eventId);
    const body = validate(scanSchema, req.body ?? {});
    const deviceId = readDeviceId(req);
    const userId = req.user!.userId;
    if (!verifyScanCredential(eventId, body.token, body.short_code)) {
      throw new HttpError(400, 'QR token expired or invalid. Please rescan current dynamic display.');
    }
    await assertCheckInWindow(eventId);
    const reading = body.lat !== undefined && body.lng !== undefined
      ? { lat: body.lat, lng: body.lng, accuracy: body.accuracy } : undefined;
    const geo = await evaluateGeofence(eventId, reading);
    const result = await recordAttendance(eventId, userId, { method: 'QR_SCAN', recordedBy: userId, deviceId, geo });
    await logAudit(userId, 'ATTENDANCE_CHECKIN_QR', 'attendance_records', result.attendanceId,
      { eventId, via: body.token ? 'token' : 'short_code', flags: result.flags }, req.ip);
    res.status(201).json({
      message: 'Attendance successfully confirmed via dynamic QR scan',
      attendance_id: result.attendanceId,
      flags: result.flags,
      distance_m: geo?.distanceM ?? null
    });
  }

  /** POST /events/:eventId/attendance/batch: organizer uploads scans captured offline. */
  public static async offlineBatch(req: Request, res: Response): Promise<void> {
    const eventId = String(req.params.eventId);
    const items = validate(batchSchema, req.body);
    const results = await applyOfflineBatch(eventId, items, req.user!.userId);
    const checkedIn = results.filter((r) => r.status === 'CHECKED_IN').length;
    await logAudit(req.user!.userId, 'ATTENDANCE_OFFLINE_BATCH', 'events', eventId,
      { submitted: items.length, checked_in: checkedIn }, req.ip);
    res.json({ event_id: eventId, processed: results.length, checked_in: checkedIn, results });
  }

  public static async manualCheckIn(req: Request, res: Response): Promise<void> {
    const eventId = String(req.params.eventId);
    const { student_id_number, reason } = validate(manualSchema, req.body);
    await assertCheckInWindow(eventId);
    const profile = await db.queryOne<{ user_id: string; full_name: string }>(
      'SELECT user_id, full_name FROM student_profiles WHERE student_id_number = $1', [student_id_number]);
    if (!profile) throw new HttpError(404, 'Student profile not found with provided ID');

    const { attendanceId } = await recordAttendance(eventId, profile.user_id,
      { method: 'MANUAL_OVERRIDE', recordedBy: req.user!.userId });
    await logAudit(req.user!.userId, 'ATTENDANCE_MANUAL_OVERRIDE', 'attendance_records', attendanceId,
      { eventId, student_id_number, reason }, req.ip);
    res.status(201).json({ message: `Manual attendance confirmed for ${profile.full_name}`, attendance_id: attendanceId });
  }

  public static async getEventAttendance(req: Request, res: Response): Promise<void> {
    const eventId = String(req.params.eventId);
    const event = await db.queryOne<{ capacity: number; registered_count: number }>(
      'SELECT capacity, registered_count FROM events WHERE id = $1', [eventId]);
    const rows = await db.query<Record<string, unknown> & { flags: string | null }>(`
      SELECT a.id, a.check_in_time, a.method, a.flags, a.distance_m,
             u.email, p.full_name, p.student_id_number, p.department
      FROM attendance_records a
      JOIN users u ON a.user_id = u.id
      LEFT JOIN student_profiles p ON u.id = p.user_id
      WHERE a.event_id = $1
      ORDER BY a.check_in_time DESC
    `, [eventId]);
    const records = rows.map((r) => ({ ...r, flags: parseFlags(r.flags) }));
    const flaggedCount = records.filter((r) => r.flags.length > 0).length;
    const registered = event?.registered_count || 0;
    const rate = registered > 0 ? Number(((records.length / registered) * 100).toFixed(1)) : 0;
    res.json({
      total_checked_in: records.length,
      registered_count: registered,
      capacity: event?.capacity || 0,
      attendance_rate_percent: rate,
      flagged_count: flaggedCount,
      attendees: records
    });
  }
}
