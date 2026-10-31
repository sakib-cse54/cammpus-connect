/**
 * Pure OBE attainment engine: maps co-curricular activity to BAETE program
 * outcomes PO1 to PO12. No DB access, so it is fully unit-testable.
 *
 * Points per PO:
 *   - attended event tagged with the PO at weight w: +w
 *   - reflection written for that event: +0.5 * w (bonus)
 *   - approved club role mapped to the PO at weight w, held for m months:
 *     +w * min(m, ROLE_MONTH_CAP) / 3  (a role counts at most one academic year)
 *
 * Levels (documented thresholds, inclusive lower bounds):
 *   NOT_STARTED  points == 0
 *   DEVELOPING   0 < points < 3
 *   PROFICIENT   3 <= points < 6
 *   EXEMPLARY    points >= 6
 */

export const PO_CODES = ['PO1', 'PO2', 'PO3', 'PO4', 'PO5', 'PO6', 'PO7', 'PO8', 'PO9', 'PO10', 'PO11', 'PO12'] as const;
export type PoCode = (typeof PO_CODES)[number];

export const ATTAINMENT_LEVELS = ['NOT_STARTED', 'DEVELOPING', 'PROFICIENT', 'EXEMPLARY'] as const;
export type AttainmentLevel = (typeof ATTAINMENT_LEVELS)[number];

export const LEVEL_THRESHOLDS: Readonly<Record<Exclude<AttainmentLevel, 'NOT_STARTED'>, number>> = Object.freeze({
  DEVELOPING: 0, PROFICIENT: 3, EXEMPLARY: 6
});

export const REFLECTION_BONUS = 0.5;
export const ROLE_MONTH_CAP = 12;

export type PoWeights = Readonly<Partial<Record<string, number>>>;

/** Default role mapping; mirrors the role_outcomes rows seeded by migration 007. */
export const DEFAULT_ROLE_OUTCOMES: Readonly<Record<string, PoWeights>> = Object.freeze({
  PRESIDENT: { PO9: 3, PO11: 2, PO10: 1 },
  TREASURER: { PO11: 3, PO9: 1 },
  EXECUTIVE: { PO9: 2, PO10: 1 },
  MEMBER: { PO9: 1 }
});

export interface AttendanceInput {
  readonly eventId: string;
  readonly poWeights: PoWeights;
}

export interface RoleInput {
  readonly clubRole: string;
  readonly months: number;
}

export interface AttainmentInput {
  readonly attendances: readonly AttendanceInput[];
  readonly roles: readonly RoleInput[];
  readonly reflections: ReadonlySet<string>;
}

export interface PoAttainment {
  readonly code: PoCode;
  readonly points: number;
  readonly level: AttainmentLevel;
  readonly sources: { readonly events: number; readonly reflections: number; readonly roles: number };
}

export interface AttainmentResult {
  readonly outcomes: readonly PoAttainment[];
  readonly total_points: number;
  readonly level_counts: Readonly<Record<AttainmentLevel, number>>;
}

export function isPoCode(code: string): code is PoCode {
  return (PO_CODES as readonly string[]).includes(code);
}

export function levelFor(points: number): AttainmentLevel {
  if (!(points > 0)) return 'NOT_STARTED';
  if (points >= LEVEL_THRESHOLDS.EXEMPLARY) return 'EXEMPLARY';
  if (points >= LEVEL_THRESHOLDS.PROFICIENT) return 'PROFICIENT';
  return 'DEVELOPING';
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Clamps a weight to the valid 1..3 range; anything non-finite or below 1 counts as 0. */
function safeWeight(w: number | undefined): number {
  if (w === undefined || !Number.isFinite(w) || w < 1) return 0;
  return Math.min(3, w);
}

interface Tally {
  points: number;
  events: number;
  reflections: number;
  roles: number;
}

function emptyTallies(): Map<PoCode, Tally> {
  return new Map(PO_CODES.map((c) => [c, { points: 0, events: 0, reflections: 0, roles: 0 }]));
}

function addAttendances(t: Map<PoCode, Tally>, input: AttainmentInput): void {
  for (const a of input.attendances) {
    const reflected = input.reflections.has(a.eventId);
    for (const [code, raw] of Object.entries(a.poWeights)) {
      const w = safeWeight(raw);
      const tally = isPoCode(code) ? t.get(code) : undefined;
      if (!tally || w === 0) continue;
      tally.points += w + (reflected ? REFLECTION_BONUS * w : 0);
      tally.events += 1;
      if (reflected) tally.reflections += 1;
    }
  }
}

function addRoles(t: Map<PoCode, Tally>, roles: readonly RoleInput[], mapping: Readonly<Record<string, PoWeights>>): void {
  for (const r of roles) {
    const months = Number.isFinite(r.months) ? Math.max(0, Math.min(ROLE_MONTH_CAP, r.months)) : 0;
    if (months === 0) continue;
    for (const [code, raw] of Object.entries(mapping[r.clubRole] ?? {})) {
      const tally = isPoCode(code) ? t.get(code) : undefined;
      const w = safeWeight(raw);
      if (!tally || w === 0) continue;
      tally.points += (w * months) / 3;
      tally.roles += 1;
    }
  }
}

export function computeAttainment(
  input: AttainmentInput,
  roleOutcomes: Readonly<Record<string, PoWeights>> = DEFAULT_ROLE_OUTCOMES
): AttainmentResult {
  const tallies = emptyTallies();
  addAttendances(tallies, input);
  addRoles(tallies, input.roles, roleOutcomes);
  const outcomes = PO_CODES.map((code): PoAttainment => {
    const t = tallies.get(code)!;
    const points = round2(t.points);
    return { code, points, level: levelFor(points), sources: { events: t.events, reflections: t.reflections, roles: t.roles } };
  });
  const level_counts = Object.fromEntries(ATTAINMENT_LEVELS.map((l) => [l, outcomes.filter((o) => o.level === l).length])) as Record<AttainmentLevel, number>;
  return { outcomes, total_points: round2(outcomes.reduce((s, o) => s + o.points, 0)), level_counts };
}

/** Whole months between two instants (30-day months), never negative. */
export function monthsBetween(fromIso: string, toMs: number): number {
  const from = Date.parse(fromIso);
  if (!Number.isFinite(from)) return 0;
  return Math.max(0, Math.floor((toMs - from) / (30 * 24 * 3600 * 1000)));
}
