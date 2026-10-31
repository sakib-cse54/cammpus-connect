import { z } from 'zod';
import { isoDateTimeSchema } from '../utils/time.js';
import { MAX_EVENT_CAPACITY } from './eventSchemas.js';

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
const startBeforeEnd = <T extends { start?: string; end?: string }>(v: T): boolean =>
  !v.start || !v.end || Date.parse(v.start) < Date.parse(v.end);

export const scheduleCheckSchema = z.object({
  start: isoDateTimeSchema,
  end: isoDateTimeSchema,
  venue_id: z.string().trim().min(1).max(100).optional(),
  capacity: z.coerce.number().int().min(1).max(MAX_EVENT_CAPACITY).optional(),
  exclude_event_id: z.string().trim().min(1).max(100).optional()
}).refine(startBeforeEnd, { message: 'end must be after start', path: ['end'] });

export const freeSlotsQuerySchema = z.object({
  date: dateOnly,
  duration: z.coerce.number().int().min(15).max(12 * 60).default(120)
});

export const calendarQuerySchema = z.object({
  from: isoDateTimeSchema.optional(),
  to: isoDateTimeSchema.optional()
}).refine((v) => !v.from || !v.to || Date.parse(v.from) < Date.parse(v.to), { message: 'to must be after from', path: ['to'] });

const blackoutFields = {
  semester_id: z.string().trim().min(1).max(100).nullable(),
  kind: z.enum(['FINAL_EXAM', 'MIDTERM', 'HOLIDAY', 'NATIONAL_DAY']),
  title_en: z.string().trim().min(2).max(200),
  title_bn: z.string().trim().max(200).nullable(),
  starts_at: isoDateTimeSchema,
  ends_at: isoDateTimeSchema,
  tentative: z.boolean(),
  severity: z.enum(['BLOCK', 'WARN'])
};

const blackoutRange = (v: { starts_at?: string; ends_at?: string }): boolean =>
  !v.starts_at || !v.ends_at || Date.parse(v.starts_at) < Date.parse(v.ends_at);

export const createBlackoutSchema = z.object({
  ...blackoutFields,
  semester_id: blackoutFields.semester_id.default(null),
  title_bn: blackoutFields.title_bn.default(null),
  tentative: blackoutFields.tentative.default(false)
}).refine(blackoutRange, { message: 'ends_at must be after starts_at', path: ['ends_at'] });

export const updateBlackoutSchema = z.object(blackoutFields).partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });

export type BlackoutPatch = z.output<typeof updateBlackoutSchema>;

const venueFields = {
  name: z.string().trim().min(2).max(200),
  building: z.string().trim().max(200).nullable(),
  capacity: z.coerce.number().int().min(1).max(MAX_EVENT_CAPACITY),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  radius_m: z.number().int().min(5).max(2000).nullable(),
  is_active: z.boolean()
};

export const createVenueSchema = z.object({
  ...venueFields,
  building: venueFields.building.default(null),
  latitude: venueFields.latitude.default(null),
  longitude: venueFields.longitude.default(null),
  radius_m: venueFields.radius_m.default(null),
  is_active: venueFields.is_active.default(true)
});

export const updateVenueSchema = z.object(venueFields).partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });

export type VenuePatch = z.output<typeof updateVenueSchema>;
