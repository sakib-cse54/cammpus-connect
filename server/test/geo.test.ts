import { describe, it, expect } from 'vitest';
import { haversineMeters, isOutOfRange } from '../src/utils/geo.js';

describe('haversineMeters', () => {
  it('is zero for the same point', () => {
    expect(haversineMeters({ lat: 23.8014, lng: 90.4281 }, { lat: 23.8014, lng: 90.4281 })).toBe(0);
  });
  it('matches one degree of latitude (~111.2 km)', () => {
    expect(haversineMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111195, -1);
  });
  it('measures a short campus distance (~111 m per 0.001 deg lat)', () => {
    const d = haversineMeters({ lat: 23.8014, lng: 90.4281 }, { lat: 23.8024, lng: 90.4281 });
    expect(d).toBeGreaterThan(110);
    expect(d).toBeLessThan(112);
  });
  it('is symmetric and handles antimeridian crossing', () => {
    const a = { lat: 10, lng: 179.9 };
    const b = { lat: 10, lng: -179.9 };
    expect(haversineMeters(a, b)).toBeCloseTo(haversineMeters(b, a), 6);
    expect(haversineMeters(a, b)).toBeLessThan(25000);
  });
});

describe('isOutOfRange', () => {
  it('credits accuracy up to 100 m', () => {
    expect(isOutOfRange(50, 30, 10)).toBe(true);
    expect(isOutOfRange(50, 30, 25)).toBe(false);
    expect(isOutOfRange(140, 30, 500)).toBe(true);
    expect(isOutOfRange(129, 30, 500)).toBe(false);
  });
  it('treats missing or negative accuracy as zero', () => {
    expect(isOutOfRange(31, 30, undefined)).toBe(true);
    expect(isOutOfRange(31, 30, -50)).toBe(true);
    expect(isOutOfRange(30, 30, undefined)).toBe(false);
  });
});
