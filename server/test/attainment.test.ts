import { describe, it, expect } from 'vitest';
import {
  computeAttainment, levelFor, monthsBetween, isPoCode, PO_CODES, DEFAULT_ROLE_OUTCOMES, ROLE_MONTH_CAP
} from '../src/services/attainmentService.js';

const none = new Set<string>();
const po = (r: ReturnType<typeof computeAttainment>, code: string) => r.outcomes.find((o) => o.code === code)!;

describe('levelFor thresholds', () => {
  it.each([
    [0, 'NOT_STARTED'], [-1, 'NOT_STARTED'], [Number.NaN, 'NOT_STARTED'], [0.01, 'DEVELOPING'], [2.99, 'DEVELOPING'],
    [3, 'PROFICIENT'], [5.99, 'PROFICIENT'], [6, 'EXEMPLARY'], [100, 'EXEMPLARY']
  ])('%s points -> %s', (points, level) => {
    expect(levelFor(points)).toBe(level);
  });
});

describe('computeAttainment', () => {
  it('returns all 12 POs at NOT_STARTED for an empty record', () => {
    const r = computeAttainment({ attendances: [], roles: [], reflections: none });
    expect(r.outcomes.map((o) => o.code)).toEqual([...PO_CODES]);
    expect(r.outcomes.every((o) => o.level === 'NOT_STARTED' && o.points === 0)).toBe(true);
    expect(r.level_counts.NOT_STARTED).toBe(12);
    expect(r.total_points).toBe(0);
  });

  it('sums event weights per PO', () => {
    const r = computeAttainment({
      attendances: [{ eventId: 'a', poWeights: { PO5: 3, PO9: 1 } }, { eventId: 'b', poWeights: { PO5: 2 } }],
      roles: [], reflections: none
    });
    expect(po(r, 'PO5')).toMatchObject({ points: 5, level: 'PROFICIENT', sources: { events: 2, reflections: 0, roles: 0 } });
    expect(po(r, 'PO9')).toMatchObject({ points: 1, level: 'DEVELOPING' });
    expect(r.total_points).toBe(6);
  });

  it('adds a 0.5x weight reflection bonus only for reflected events', () => {
    const r = computeAttainment({
      attendances: [{ eventId: 'a', poWeights: { PO10: 2 } }, { eventId: 'b', poWeights: { PO10: 2 } }],
      roles: [], reflections: new Set(['a'])
    });
    expect(po(r, 'PO10')).toMatchObject({ points: 5, sources: { events: 2, reflections: 1 } });
  });

  it('ignores unknown PO codes and out-of-range weights, and clamps weights above 3', () => {
    const r = computeAttainment({
      attendances: [{ eventId: 'a', poWeights: { PO13: 3, po1: 3, PO2: 0, PO3: -2, PO4: 9, PO6: Number.NaN } }],
      roles: [], reflections: none
    });
    expect(r.total_points).toBe(3);
    expect(po(r, 'PO4').points).toBe(3);
  });

  it('credits club roles by months held, capped at one year', () => {
    const r = computeAttainment({ attendances: [], roles: [{ clubRole: 'PRESIDENT', months: 6 }], reflections: none });
    expect(po(r, 'PO9')).toMatchObject({ points: 6, level: 'EXEMPLARY', sources: { roles: 1 } });
    expect(po(r, 'PO11').points).toBe(4);
    const capped = computeAttainment({ attendances: [], roles: [{ clubRole: 'MEMBER', months: 60 }], reflections: none });
    expect(po(capped, 'PO9').points).toBe(ROLE_MONTH_CAP / 3);
  });

  it('ignores zero, negative or unknown roles', () => {
    const r = computeAttainment({
      attendances: [],
      roles: [{ clubRole: 'MEMBER', months: 0 }, { clubRole: 'MEMBER', months: -5 }, { clubRole: 'GHOST', months: 6 }],
      reflections: none
    });
    expect(r.total_points).toBe(0);
  });

  it('accepts a custom role mapping', () => {
    const r = computeAttainment({ attendances: [], roles: [{ clubRole: 'MEMBER', months: 3 }], reflections: none }, { MEMBER: { PO12: 3 } });
    expect(po(r, 'PO12').points).toBe(3);
    expect(po(r, 'PO9').points).toBe(0);
  });

  it('rounds points to two decimals', () => {
    const r = computeAttainment({ attendances: [], roles: [{ clubRole: 'MEMBER', months: 1 }], reflections: none });
    expect(po(r, 'PO9').points).toBe(0.33);
  });

  it('default role mapping matches the seeded examples', () => {
    expect(DEFAULT_ROLE_OUTCOMES.TREASURER.PO11).toBe(3);
    expect(DEFAULT_ROLE_OUTCOMES.EXECUTIVE).toMatchObject({ PO9: 2, PO10: 1 });
  });
});

describe('helpers', () => {
  it('monthsBetween counts whole 30-day months and never goes negative', () => {
    const now = Date.parse('2026-10-30T00:00:00Z');
    expect(monthsBetween('2026-07-01T00:00:00Z', now)).toBe(4);
    expect(monthsBetween('2027-01-01T00:00:00Z', now)).toBe(0);
    expect(monthsBetween('garbage', now)).toBe(0);
  });

  it('isPoCode', () => {
    expect(isPoCode('PO12')).toBe(true);
    expect(isPoCode('PO0')).toBe(false);
  });
});
