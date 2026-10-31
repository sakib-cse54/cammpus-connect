/**
 * Data access for BAETE program outcomes: the PO catalogue, event PO tags,
 * role mappings, reflections and per-student attainment inputs.
 */
import { db, DbClient } from '../db/index.js';
import { nowIso } from '../utils/time.js';
import { AttainmentInput, PoWeights, monthsBetween } from './attainmentService.js';
import { PoTag } from '../validation/outcomeSchemas.js';

export interface ProgramOutcome {
  readonly code: string;
  readonly framework: string;
  readonly title_en: string;
  readonly title_bn: string;
  readonly description: string;
}

export interface EventPoTag {
  readonly code: string;
  readonly weight: number;
  readonly title_en: string;
  readonly title_bn: string;
}

const PO_ORDER = 'CAST(SUBSTR(po_code, 3) AS INTEGER)';

export async function listOutcomes(): Promise<ProgramOutcome[]> {
  return db.query<ProgramOutcome>(
    `SELECT code, framework, title_en, title_bn, description FROM program_outcomes
     WHERE framework = 'BAETE' ORDER BY CAST(SUBSTR(code, 3) AS INTEGER)`);
}

export async function listRoleOutcomes(client: DbClient = db): Promise<Record<string, PoWeights>> {
  const rows = await client.query<{ club_role: string; po_code: string; weight: number }>(
    `SELECT club_role, po_code, weight FROM role_outcomes ORDER BY club_role, ${PO_ORDER}`);
  return rows.reduce<Record<string, PoWeights>>(
    (acc, r) => ({ ...acc, [r.club_role]: { ...(acc[r.club_role] ?? {}), [r.po_code]: Number(r.weight) } }), {});
}

export async function getEventOutcomes(eventId: string, client: DbClient = db): Promise<EventPoTag[]> {
  return client.query<EventPoTag>(
    `SELECT eo.po_code as code, eo.weight, po.title_en, po.title_bn
     FROM event_outcomes eo JOIN program_outcomes po ON po.code = eo.po_code AND po.framework = 'BAETE'
     WHERE eo.event_id = $1 ORDER BY ${PO_ORDER}`, [eventId]);
}

/** Replaces the full tag set of an event (call inside a transaction for atomicity). */
export async function replaceEventOutcomes(client: DbClient, eventId: string, tags: readonly PoTag[], userId: string): Promise<void> {
  await client.execute('DELETE FROM event_outcomes WHERE event_id = $1', [eventId]);
  const at = nowIso();
  for (const t of tags) {
    await client.execute(
      'INSERT INTO event_outcomes (event_id, po_code, weight, tagged_by, tagged_at) VALUES ($1, $2, $3, $4, $5)',
      [eventId, t.code, t.weight, userId, at]);
  }
}

export async function hasAttended(eventId: string, userId: string): Promise<boolean> {
  return Boolean(await db.queryOne('SELECT id FROM attendance_records WHERE event_id = $1 AND user_id = $2', [eventId, userId]));
}

/** Upserts the student's reflection for an event; returns the stored row. */
export async function upsertReflection(id: string, userId: string, eventId: string, text: string): Promise<Record<string, unknown>> {
  const at = nowIso();
  await db.execute(
    `INSERT INTO reflections (id, user_id, event_id, text, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $5)
     ON CONFLICT (user_id, event_id) DO UPDATE SET text = excluded.text, updated_at = excluded.updated_at`,
    [id, userId, eventId, text, at]);
  const row = await db.queryOne<Record<string, unknown>>(
    'SELECT id, event_id, text, created_at, updated_at FROM reflections WHERE user_id = $1 AND event_id = $2', [userId, eventId]);
  return row ?? {};
}

export interface AttendedRow {
  readonly user_id: string;
  readonly event_id: string;
  readonly check_in_time: string;
}

export interface RoleRow {
  readonly user_id: string;
  readonly club_role: string;
  readonly joined_at: string | null;
}

/** Tags for many events at once, keyed by event id. */
export async function tagsByEvent(eventIds: readonly string[]): Promise<Map<string, Record<string, number>>> {
  if (eventIds.length === 0) return new Map();
  const ph = eventIds.map((_, i) => `$${i + 1}`).join(', ');
  const rows = await db.query<{ event_id: string; po_code: string; weight: number }>(
    `SELECT event_id, po_code, weight FROM event_outcomes WHERE event_id IN (${ph})`, eventIds);
  return rows.reduce((m, r) => m.set(r.event_id, { ...(m.get(r.event_id) ?? {}), [r.po_code]: Number(r.weight) }),
    new Map<string, Record<string, number>>());
}

/** Builds the pure attainment input for one student from already-loaded rows. */
export function toAttainmentInput(
  attended: readonly AttendedRow[], roles: readonly RoleRow[], reflected: ReadonlySet<string>,
  tags: ReadonlyMap<string, Record<string, number>>, nowMs: number
): AttainmentInput {
  return {
    attendances: attended.map((a) => ({ eventId: a.event_id, poWeights: tags.get(a.event_id) ?? {} })),
    // An approved role counts at least one month so new office bearers are credited.
    roles: roles.map((r) => ({ clubRole: r.club_role, months: Math.max(1, r.joined_at ? monthsBetween(r.joined_at, nowMs) : 1) })),
    reflections: reflected
  };
}
