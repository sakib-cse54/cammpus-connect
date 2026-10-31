import { describe, it, expect } from 'vitest';
import { toBanglaDigits, formatDhaka, toBongabdo, toDhakaInputValue, fromDhakaInputValue, toDhakaDay } from './dateBd.js';

describe('toBanglaDigits', () => {
  it('converts every ASCII digit', () => {
    expect(toBanglaDigits('0123456789')).toBe('০১২৩৪৫৬৭৮৯');
    expect(toBanglaDigits(2026)).toBe('২০২৬');
  });
  it('leaves other characters alone', () => {
    expect(toBanglaDigits('10:30 AM')).toBe('১০:৩০ AM');
  });
});

describe('formatDhaka', () => {
  it('renders in Asia/Dhaka (UTC+6)', () => {
    const out = formatDhaka('2026-11-02T20:00:00.000Z', 'en', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
    expect(out).toContain('03/11/2026');
    expect(out).toContain('02:00');
  });
  it('uses Bangla digits for bn', () => {
    const out = formatDhaka('2026-11-02T04:00:00.000Z', 'bn', { year: 'numeric' });
    expect(out).toBe('২০২৬');
  });
  it('returns - for invalid input', () => {
    expect(formatDhaka('not a date')).toBe('-');
  });
});

describe('toDhakaDay', () => {
  it('rolls over at Dhaka midnight', () => {
    expect(toDhakaDay('2026-04-13T17:59:00Z')).toBe('2026-04-13');
    expect(toDhakaDay('2026-04-13T18:00:00Z')).toBe('2026-04-14');
  });
});

describe('datetime-local conversion', () => {
  it('ISO -> Dhaka input value', () => {
    expect(toDhakaInputValue('2026-11-02T04:00:00.000Z')).toBe('2026-11-02T10:00');
    expect(toDhakaInputValue('2026-11-02T20:30:00Z')).toBe('2026-11-03T02:30');
    expect(toDhakaInputValue('')).toBe('');
    expect(toDhakaInputValue(null)).toBe('');
  });
  it('input value -> ISO with +06:00', () => {
    expect(fromDhakaInputValue('2026-11-02T10:00')).toBe('2026-11-02T10:00:00+06:00');
    expect(fromDhakaInputValue('2026-02-30T10:00')).toBe('');
    expect(fromDhakaInputValue('garbage')).toBe('');
  });
  it('round-trips', () => {
    const iso = fromDhakaInputValue('2026-12-16T09:15');
    expect(new Date(iso).toISOString()).toBe('2026-12-16T03:15:00.000Z');
    expect(toDhakaInputValue(iso)).toBe('2026-12-16T09:15');
  });
});

describe('toBongabdo (2019 revision)', () => {
  it('Pohela Boishakh is 14 April', () => {
    const b = toBongabdo('2026-04-14T00:00:00+06:00');
    expect(b).toMatchObject({ year: 1433, monthIndex: 0, day: 1, monthName: 'বৈশাখ' });
    expect(b?.label).toBe('১ বৈশাখ ১৪৩৩');
  });
  it('13 April is the last day of Choitro', () => {
    expect(toBongabdo('2026-04-13T12:00:00+06:00')).toMatchObject({ year: 1432, monthIndex: 11, day: 30 });
  });
  it('fixed national days map correctly', () => {
    expect(toBongabdo('2026-12-16T10:00:00+06:00')).toMatchObject({ monthIndex: 8, day: 1 }); // 1 Poush
    expect(toBongabdo('2027-02-21T10:00:00+06:00')).toMatchObject({ monthIndex: 10, day: 8 }); // 8 Falgun
    expect(toBongabdo('2026-03-26T10:00:00+06:00')).toMatchObject({ monthIndex: 11, day: 12 }); // 12 Choitro
  });
  it('Falgun has 30 days in a Gregorian leap year', () => {
    expect(toBongabdo('2028-03-14T10:00:00+06:00')).toMatchObject({ monthIndex: 10, day: 30 });
    expect(toBongabdo('2027-03-14T10:00:00+06:00')).toMatchObject({ monthIndex: 10, day: 29 });
    expect(toBongabdo('2027-03-15T10:00:00+06:00')).toMatchObject({ monthIndex: 11, day: 1 });
  });
  it('uses the Dhaka day, not UTC', () => {
    expect(toBongabdo('2026-04-13T18:30:00Z')).toMatchObject({ year: 1433, day: 1 });
  });
  it('returns null for invalid input', () => {
    expect(toBongabdo('nope')).toBeNull();
  });
});
