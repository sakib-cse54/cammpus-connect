import { z } from 'zod';
import { isoDateTimeSchema, toIso } from '../utils/time.js';
import { PUBLIC_EVENT_STATUSES } from '../services/eventLifecycle.js';
import { poTagsSchema } from './outcomeSchemas.js';

export const MAX_EVENT_CAPACITY = 5000;

const editableFields = {
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(5000),
  venue: z.string().trim().min(1).max(200),
  start_time: isoDateTimeSchema,
  end_time: isoDateTimeSchema,
  registration_deadline: isoDateTimeSchema,
  capacity: z.coerce.number().int().min(1).max(MAX_EVENT_CAPACITY),
  requires_feedback_for_cert: z.boolean(),
  venue_id: z.string().trim().min(1).max(100).nullable()
};

/** ADMIN or club advisor may override schedule errors with a logged reason. */
const overrideReason = z.string().trim().min(5).max(500).optional();

export interface EventTimes {
  readonly start_time: string;
  readonly end_time: string;
  readonly registration_deadline: string;
}

/** Adds issues when start >= end or the deadline is after the start. */
export function checkEventTimes(t: EventTimes, ctx: z.RefinementCtx): void {
  const start = Date.parse(t.start_time);
  if (start >= Date.parse(t.end_time)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['end_time'], message: 'end_time must be after start_time' });
  }
  if (Date.parse(t.registration_deadline) > start) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['registration_deadline'],
      message: 'registration_deadline must be on or before start_time'
    });
  }
}

export const createEventSchema = z
  .object({
    club_id: z.string().trim().min(1),
    ...editableFields,
    description: editableFields.description.default(''),
    requires_feedback_for_cert: editableFields.requires_feedback_for_cert.default(true),
    venue: editableFields.venue.optional(),
    venue_id: editableFields.venue_id.optional(),
    override_reason: overrideReason,
    po_tags: poTagsSchema.optional()
  })
  .superRefine(checkEventTimes)
  .refine((v) => Boolean(v.venue || v.venue_id), { message: 'venue or venue_id is required', path: ['venue'] });

export type CreateEventInput = z.output<typeof createEventSchema>;

/** PATCH payload: any subset of editable fields (club_id cannot change). */
export const updateEventSchema = z
  .object(editableFields)
  .partial()
  .extend({ override_reason: overrideReason, po_tags: poTagsSchema.optional() })
  .refine((v) => Object.keys(v).some((k) => k !== 'override_reason'), { message: 'At least one field is required' });

export type UpdateEventInput = z.output<typeof updateEventSchema>;

/** Validates an already-merged set of times (used when patching). */
export const eventTimesSchema = z
  .object({ start_time: z.string(), end_time: z.string(), registration_deadline: z.string() })
  .superRefine(checkEventTimes);

export const merged = (current: EventTimes, patch: Partial<EventTimes>): EventTimes => ({
  start_time: patch.start_time ?? current.start_time,
  end_time: patch.end_time ?? current.end_time,
  registration_deadline: patch.registration_deadline ?? current.registration_deadline
});

/** Normalizes any ISO-with-offset datetime fields to UTC 'Z' strings. */
export function normalizeTimes<T extends Partial<EventTimes>>(input: T): T {
  return {
    ...input,
    ...(input.start_time ? { start_time: toIso(input.start_time) } : {}),
    ...(input.end_time ? { end_time: toIso(input.end_time) } : {}),
    ...(input.registration_deadline ? { registration_deadline: toIso(input.registration_deadline) } : {})
  };
}

export const eventListQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  category: z.string().trim().max(100).optional(),
  club_id: z.string().trim().max(100).optional(),
  status: z.enum(PUBLIC_EVENT_STATUSES).optional()
});

export const reviewEventSchema = z
  .object({
    decision: z.enum(['APPROVED', 'REJECTED']),
    remarks: z.string().trim().max(2000).optional(),
    override_reason: overrideReason,
    po_tags: poTagsSchema.optional()
  })
  .refine((v) => v.decision === 'APPROVED' || (v.remarks ?? '').length > 0, {
    message: 'Remarks are mandatory when rejecting an event proposal',
    path: ['remarks']
  });

export const cancelEventSchema = z.object({
  reason: z.string().trim().min(3).max(1000)
});

export const submitEventSchema = z.object({ override_reason: overrideReason }).default({});
