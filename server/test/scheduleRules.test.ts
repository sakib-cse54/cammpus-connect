import { describe, it, expect } from 'vitest';
import {
  overlaps, evaluateSchedule, findFreeSlots, dhakaDate, dhakaInstant, toInterval,
  BlackoutWindow, ScheduleData, VenueInfo
} from '../src/services/scheduleRules.js';

const T = (hhmm: string, day = '2026-11-10'): string => new Date(`${day}T${hhmm}:00+06:00`).toISOString();
const venue: VenueInfo = { id: 'v1', name: 'Hall', capacity: 100, is_active: true };
const empty: ScheduleData = { blackouts: [], semesters: [], venue: null, venueEvents: [] };
const blackout = (over: Partial<BlackoutWindow>): BlackoutWindow => ({
  id: 'b1', kind: 'MIDTERM', title_en: 'Midterm', starts_at: T('00:00'), ends_at: T('00:00', '2026-11-11'),
  tentative: false, severity: 'BLOCK', ...over
});

describe('overlaps (half-open intervals)', () => {
  const a = toInterval(T('10:00'), T('12:00'));
  it.each([
    ['inside', T('10:30'), T('11:30'), true],
    ['covering', T('09:00'), T('13:00'), true],
    ['overlap start', T('09:00'), T('10:01'), true],
    ['overlap end', T('11:59'), T('14:00'), true],
    ['identical', T('10:00'), T('12:00'), true],
    ['touching before', T('08:00'), T('10:00'), false],
    ['touching after', T('12:00'), T('13:00'), false],
    ['disjoint', T('14:00'), T('15:00'), false]
  ])('%s', (_label, s, e, expected) => {
    expect(overlaps(a, toInterval(s, e))).toBe(expected);
    expect(overlaps(toInterval(s, e), a)).toBe(expected);
  });
});

describe('Dhaka calendar helpers', () => {
  it('maps late-evening UTC to the next Dhaka day', () => {
    expect(dhakaDate('2026-12-15T18:30:00.000Z')).toBe('2026-12-16');
    expect(dhakaDate('2026-12-15T17:59:59.000Z')).toBe('2026-12-15');
  });
  it('builds instants from Dhaka wall time', () => {
    expect(new Date(dhakaInstant('2026-11-10', 8)).toISOString()).toBe('2026-11-10T02:00:00.000Z');
  });
});

describe('evaluateSchedule', () => {
  const p = { start: T('10:00'), end: T('12:00') };

  it('returns nothing for an unconstrained slot', () => {
    expect(evaluateSchedule(p, empty)).toEqual({ errors: [], warnings: [] });
  });

  it('BLOCK blackout is an error, WARN blackout a warning', () => {
    const r = evaluateSchedule(p, { ...empty, blackouts: [blackout({}), blackout({ id: 'b2', severity: 'WARN', kind: 'NATIONAL_DAY', tentative: true })] });
    expect(r.errors.map((i) => i.code)).toEqual(['BLACKOUT_BLOCK']);
    expect(r.warnings.map((i) => i.code)).toEqual(['BLACKOUT_WARN']);
    expect(r.warnings[0].message).toContain('tentative');
  });

  it('ignores blackouts that only touch the slot', () => {
    const r = evaluateSchedule(p, { ...empty, blackouts: [blackout({ starts_at: T('12:00'), ends_at: T('18:00') })] });
    expect(r.errors).toEqual([]);
  });

  it('flags venue conflicts but excludes the event itself', () => {
    const venueEvents = [
      { id: 'e1', title: 'Other', start_time: T('11:00'), end_time: T('13:00') },
      { id: 'self', title: 'Self', start_time: T('10:00'), end_time: T('12:00') },
      { id: 'e2', title: 'Adjacent', start_time: T('12:00'), end_time: T('13:00') }
    ];
    const r = evaluateSchedule({ ...p, excludeEventId: 'self' }, { ...empty, venue, venueEvents });
    expect(r.errors.map((i) => i.ref?.id)).toEqual(['e1']);
    expect(r.errors[0].code).toBe('VENUE_CONFLICT');
  });

  it('ignores venue events when no venue is chosen', () => {
    const venueEvents = [{ id: 'e1', title: 'Other', start_time: T('11:00'), end_time: T('13:00') }];
    expect(evaluateSchedule(p, { ...empty, venueEvents }).errors).toEqual([]);
  });

  it('flags capacity above venue capacity and inactive venues', () => {
    expect(evaluateSchedule({ ...p, capacity: 100 }, { ...empty, venue }).errors).toEqual([]);
    const r = evaluateSchedule({ ...p, capacity: 101 }, { ...empty, venue: { ...venue, is_active: false } });
    expect(r.errors.map((i) => i.code)).toEqual(['VENUE_INACTIVE', 'VENUE_CAPACITY']);
  });

  it('warns OUTSIDE_SEMESTER only when semesters exist and none contains the slot', () => {
    const sem = { id: 's', name: 'Autumn', start_date: '2026-09-01', end_date: '2026-11-10' };
    expect(evaluateSchedule(p, { ...empty, semesters: [sem] }).warnings).toEqual([]);
    const late = { start: T('23:00'), end: T('01:00', '2026-11-11') };
    expect(evaluateSchedule(late, { ...empty, semesters: [sem] }).warnings.map((i) => i.code)).toEqual(['OUTSIDE_SEMESTER']);
    expect(evaluateSchedule(late, empty).warnings).toEqual([]);
  });
});

describe('findFreeSlots', () => {
  const date = '2026-11-10';
  it('returns the first 5 slots from 08:00 Dhaka on an empty day', () => {
    const slots = findFreeSlots({ date, durationMinutes: 60, busy: [] });
    expect(slots).toHaveLength(5);
    expect(slots[0]).toEqual({ start: T('08:00'), end: T('09:00') });
    expect(slots[1].start).toBe(T('08:30'));
  });
  it('skips busy intervals and never ends after 20:00', () => {
    const busy = [toInterval(T('08:00'), T('18:00'))];
    const slots = findFreeSlots({ date, durationMinutes: 120, busy });
    expect(slots).toEqual([{ start: T('18:00'), end: T('20:00') }]);
  });
  it('returns nothing when the day is blocked or the duration is too long', () => {
    expect(findFreeSlots({ date, durationMinutes: 60, busy: [toInterval(T('00:00'), T('23:00'))] })).toEqual([]);
    expect(findFreeSlots({ date, durationMinutes: 13 * 60, busy: [] })).toEqual([]);
  });
  it('skips slots in the past', () => {
    const slots = findFreeSlots({ date, durationMinutes: 60, busy: [], now: Date.parse(T('19:00')) });
    expect(slots).toEqual([{ start: T('19:00'), end: T('20:00') }]);
  });
});
