import { z } from 'zod';
import { PO_CODES } from '../services/attainmentService.js';
import { isoDateTimeSchema, toIso } from '../utils/time.js';

export const poTagSchema = z.object({
  code: z.enum(PO_CODES),
  weight: z.number().int().min(1).max(3).default(2)
});

export type PoTag = z.output<typeof poTagSchema>;

/** 0 to 12 tags, each PO code at most once. */
export const poTagsSchema = z
  .array(poTagSchema)
  .max(PO_CODES.length)
  .refine((tags) => new Set(tags.map((t) => t.code)).size === tags.length, { message: 'Duplicate PO code' });

export const putOutcomesSchema = z.object({ po_tags: poTagsSchema });

export const reflectionSchema = z.object({ text: z.string().trim().min(20).max(1000) });

export const poReportQuerySchema = z
  .object({
    department: z.string().trim().min(1).max(200).optional(),
    from: isoDateTimeSchema.optional(),
    to: isoDateTimeSchema.optional(),
    format: z.enum(['json', 'csv']).default('json')
  })
  .refine((q) => !q.from || !q.to || Date.parse(q.from) < Date.parse(q.to), { message: 'from must be before to', path: ['to'] })
  // Stored instants are UTC ISO strings: normalize offsets so string comparison is correct.
  .transform((q) => ({ ...q, from: q.from ? toIso(q.from) : undefined, to: q.to ? toIso(q.to) : undefined }));

export const transcriptIdSchema = z.string().regex(/^TR-[A-Z2-7]{20}$/, 'Invalid transcript id');
