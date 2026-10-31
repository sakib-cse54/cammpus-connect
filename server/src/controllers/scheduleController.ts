import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { logAudit } from '../middleware/audit.js';
import { HttpError, validate } from '../utils/http.js';
import { nowIso, toIso } from '../utils/time.js';
import { checkSchedule, suggestFreeSlots } from '../services/scheduleService.js';
import { redactScheduleResult } from '../services/scheduleVisibility.js';
import {
  BlackoutPatch, calendarQuerySchema, createBlackoutSchema, createVenueSchema, freeSlotsQuerySchema,
  scheduleCheckSchema, updateBlackoutSchema, updateVenueSchema, VenuePatch
} from '../validation/scheduleSchemas.js';

const DAY_MS = 86_400_000;
const DEFAULT_CALENDAR_DAYS = 180;
const VENUE_COLUMNS = ['name', 'building', 'capacity', 'latitude', 'longitude', 'radius_m', 'is_active'] as const;
const BLACKOUT_COLUMNS = ['semester_id', 'kind', 'title_en', 'title_bn', 'starts_at', 'ends_at', 'tentative', 'severity'] as const;

type Scalar = string | number | null;

const toDb = (v: unknown): Scalar => (typeof v === 'boolean' ? (v ? 1 : 0) : (v as Scalar));

/** Builds "col = $n" assignments for whitelisted columns present in the patch. */
function assignments(columns: readonly string[], patch: Readonly<Record<string, unknown>>): [string, Scalar[]] {
  const entries = columns.filter((c) => patch[c] !== undefined).map((c): [string, Scalar] => [c, toDb(patch[c])]);
  return [entries.map(([c], i) => `${c} = $${i + 2}`).join(', '), entries.map(([, v]) => v)];
}

async function assertSemester(semesterId: string | null | undefined): Promise<void> {
  if (!semesterId) return;
  const row = await db.queryOne('SELECT id FROM semesters WHERE id = $1', [semesterId]);
  if (!row) throw new HttpError(400, 'Validation failed', [{ path: 'semester_id', message: 'Unknown semester' }], 'VALIDATION_ERROR');
}

function normalizeBlackoutTimes<T extends { starts_at?: string; ends_at?: string }>(v: T): T {
  return {
    ...v,
    ...(v.starts_at ? { starts_at: toIso(v.starts_at) } : {}),
    ...(v.ends_at ? { ends_at: toIso(v.ends_at) } : {})
  };
}

export class ScheduleController {
  /** GET /venues: active venues (admins also see inactive ones with ?all=1). */
  public static async listVenues(req: Request, res: Response): Promise<void> {
    const all = req.query.all === '1' && req.user?.role === 'ADMIN';
    const venues = await db.query(
      `SELECT * FROM venues ${all ? '' : 'WHERE is_active = 1'} ORDER BY name ASC`
    );
    res.json({ venues });
  }

  /** GET /calendar?from&to: semesters and blackouts overlapping the window (default: now to +180 days). */
  public static async getCalendar(req: Request, res: Response): Promise<void> {
    const q = validate(calendarQuerySchema, req.query);
    const from = q.from ? toIso(q.from) : nowIso();
    const to = q.to ? toIso(q.to) : new Date(Date.parse(from) + DEFAULT_CALENDAR_DAYS * DAY_MS).toISOString();
    const [semesters, blackouts] = await Promise.all([
      db.query('SELECT * FROM semesters WHERE start_date <= $2 AND end_date >= $1 ORDER BY start_date', [from.slice(0, 10), to.slice(0, 10)]),
      db.query('SELECT * FROM calendar_blackouts WHERE starts_at < $2 AND ends_at > $1 ORDER BY starts_at', [from, to])
    ]);
    res.json({ from, to, timezone: 'Asia/Dhaka', semesters, blackouts });
  }

  /** POST /schedule/check: dry-run of the rules applied on event create/edit. */
  public static async check(req: Request, res: Response): Promise<void> {
    const q = validate(scheduleCheckSchema, req.body);
    const result = await checkSchedule({
      start: q.start, end: q.end, venueId: q.venue_id, capacity: q.capacity, excludeEventId: q.exclude_event_id
    });
    res.json(await redactScheduleResult(result, req.user!));
  }

  /** GET /venues/:id/free-slots?date=YYYY-MM-DD&duration=minutes */
  public static async freeSlots(req: Request, res: Response): Promise<void> {
    const q = validate(freeSlotsQuerySchema, req.query);
    const venueId = String(req.params.id);
    const slots = await suggestFreeSlots(venueId, q.date, q.duration);
    res.json({ venue_id: venueId, date: q.date, duration_minutes: q.duration, timezone: 'Asia/Dhaka', slots });
  }

  public static async createVenue(req: Request, res: Response): Promise<void> {
    const v = validate(createVenueSchema, req.body);
    const id = uuidv4();
    const stamp = nowIso();
    const inserted = await db.execute(
      `INSERT INTO venues (id, name, building, capacity, latitude, longitude, radius_m, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9) ON CONFLICT (name) DO NOTHING`,
      [id, v.name, v.building, v.capacity, v.latitude, v.longitude, v.radius_m, v.is_active ? 1 : 0, stamp]
    );
    if (inserted.rowCount === 0) throw new HttpError(409, 'A venue with this name already exists', undefined, 'VENUE_EXISTS');
    await logAudit(req.user!.userId, 'VENUE_CREATED', 'venues', id, { name: v.name }, req.ip);
    res.status(201).json({ venue: await db.queryOne('SELECT * FROM venues WHERE id = $1', [id]) });
  }

  public static async updateVenue(req: Request, res: Response): Promise<void> {
    const id = String(req.params.id);
    const patch: VenuePatch = validate(updateVenueSchema, req.body);
    const [sets, values] = assignments(VENUE_COLUMNS, patch);
    if (patch.name) {
      const clash = await db.queryOne('SELECT id FROM venues WHERE name = $1 AND id <> $2', [patch.name, id]);
      if (clash) throw new HttpError(409, 'A venue with this name already exists', undefined, 'VENUE_EXISTS');
    }
    const result = await db.execute(
      `UPDATE venues SET ${sets}, updated_at = $${values.length + 2} WHERE id = $1`, [id, ...values, nowIso()]
    );
    if (result.rowCount === 0) throw new HttpError(404, 'Venue not found');
    await logAudit(req.user!.userId, 'VENUE_UPDATED', 'venues', id, { fields: Object.keys(patch) }, req.ip);
    res.json({ venue: await db.queryOne('SELECT * FROM venues WHERE id = $1', [id]) });
  }

  public static async createBlackout(req: Request, res: Response): Promise<void> {
    const b = normalizeBlackoutTimes(validate(createBlackoutSchema, req.body));
    await assertSemester(b.semester_id);
    const id = uuidv4();
    const stamp = nowIso();
    await db.execute(
      `INSERT INTO calendar_blackouts (id, semester_id, kind, title_en, title_bn, starts_at, ends_at, tentative, severity, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)`,
      [id, b.semester_id, b.kind, b.title_en, b.title_bn, b.starts_at, b.ends_at, b.tentative ? 1 : 0, b.severity, req.user!.userId, stamp]
    );
    await logAudit(req.user!.userId, 'BLACKOUT_CREATED', 'calendar_blackouts', id, { kind: b.kind, title: b.title_en }, req.ip);
    res.status(201).json({ blackout: await db.queryOne('SELECT * FROM calendar_blackouts WHERE id = $1', [id]) });
  }

  public static async updateBlackout(req: Request, res: Response): Promise<void> {
    const id = String(req.params.id);
    const patch: BlackoutPatch = normalizeBlackoutTimes(validate(updateBlackoutSchema, req.body));
    const current = await db.queryOne<{ starts_at: string; ends_at: string }>(
      'SELECT starts_at, ends_at FROM calendar_blackouts WHERE id = $1', [id]
    );
    if (!current) throw new HttpError(404, 'Blackout not found');
    if (Date.parse(patch.starts_at ?? current.starts_at) >= Date.parse(patch.ends_at ?? current.ends_at)) {
      throw new HttpError(400, 'Validation failed', [{ path: 'ends_at', message: 'ends_at must be after starts_at' }], 'VALIDATION_ERROR');
    }
    await assertSemester(patch.semester_id);
    const [sets, values] = assignments(BLACKOUT_COLUMNS, patch);
    await db.execute(`UPDATE calendar_blackouts SET ${sets}, updated_at = $${values.length + 2} WHERE id = $1`, [id, ...values, nowIso()]);
    await logAudit(req.user!.userId, 'BLACKOUT_UPDATED', 'calendar_blackouts', id, { fields: Object.keys(patch) }, req.ip);
    res.json({ blackout: await db.queryOne('SELECT * FROM calendar_blackouts WHERE id = $1', [id]) });
  }
}
