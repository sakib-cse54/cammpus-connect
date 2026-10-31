import { describe, it, expect } from 'vitest';
import { nowIso, toIso, addMinutes, formatDhaka, isoDateTimeSchema, DHAKA_TIME_ZONE, dhakaWallTime } from '../src/utils/time.js';

describe('time utilities', () => {
  it('nowIso returns an ISO 8601 UTC string close to now', () => {
    const value = nowIso();
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(Math.abs(Date.parse(value) - Date.now())).toBeLessThan(1000);
  });

  it('toIso converts a Dhaka offset datetime to UTC', () => {
    expect(toIso('2026-11-10T10:00:00+06:00')).toBe('2026-11-10T04:00:00.000Z');
  });

  it('toIso accepts Z-suffixed strings, Date objects and epoch millis', () => {
    expect(toIso('2026-11-10T04:00:00Z')).toBe('2026-11-10T04:00:00.000Z');
    expect(toIso(new Date(Date.UTC(2026, 0, 1)))).toBe('2026-01-01T00:00:00.000Z');
    expect(toIso(Date.UTC(2026, 0, 1))).toBe('2026-01-01T00:00:00.000Z');
  });

  it('toIso rejects strings without an explicit offset', () => {
    expect(() => toIso('2026-11-10 10:00:00')).toThrow(RangeError);
    expect(() => toIso('2026-11-10T10:00:00')).toThrow(RangeError);
  });

  it('toIso rejects unparseable input', () => {
    expect(() => toIso('not a date')).toThrow(RangeError);
    expect(() => toIso(new Date('invalid'))).toThrow(RangeError);
    expect(() => toIso(Number.NaN)).toThrow(RangeError);
  });

  it('addMinutes returns a new Date without mutating the input', () => {
    const base = new Date('2026-11-10T04:00:00.000Z');
    const later = addMinutes(base, 90);
    expect(later.toISOString()).toBe('2026-11-10T05:30:00.000Z');
    expect(base.toISOString()).toBe('2026-11-10T04:00:00.000Z');
    expect(addMinutes('2026-11-10T04:00:00Z', -30).toISOString()).toBe('2026-11-10T03:30:00.000Z');
  });

  it('formatDhaka renders wall-clock time in Asia/Dhaka (UTC+06:00)', () => {
    expect(DHAKA_TIME_ZONE).toBe('Asia/Dhaka');
    const formatted = formatDhaka('2026-11-10T04:00:00.000Z');
    expect(formatted).toContain('10 Nov 2026');
    expect(formatted).toContain('10:00');
  });

  it('formatDhaka handles day rollover across the UTC+6 offset', () => {
    expect(formatDhaka(new Date('2026-12-31T19:30:00.000Z'))).toContain('1 Jan 2027');
  });

  it('isoDateTimeSchema accepts offsets and rejects naive datetimes', () => {
    expect(isoDateTimeSchema.safeParse('2026-11-10T10:00:00+06:00').success).toBe(true);
    expect(isoDateTimeSchema.safeParse('2026-11-10T04:00:00.000Z').success).toBe(true);
    expect(isoDateTimeSchema.safeParse('2026-11-10 10:00:00').success).toBe(false);
  });

  it('dhakaWallTime resolves Dhaka calendar days and wall-clock hours', () => {
    // 20:00 UTC on 30 Oct is already 31 Oct 02:00 in Dhaka
    const base = new Date('2026-10-30T20:00:00.000Z');
    expect(dhakaWallTime(base, 0, 10).toISOString()).toBe('2026-10-31T04:00:00.000Z');
    expect(dhakaWallTime(base, 7, 9, 30).toISOString()).toBe('2026-11-07T03:30:00.000Z');
    expect(dhakaWallTime(base, -1, 0).toISOString()).toBe('2026-10-29T18:00:00.000Z');
  });
});
