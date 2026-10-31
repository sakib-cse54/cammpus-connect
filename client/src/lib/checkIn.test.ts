import { describe, it, expect } from 'vitest';
import { checkInPayload } from './checkIn.js';

describe('checkInPayload', () => {
  it('sends a 6-digit code as short_code', () => {
    expect(checkInPayload('482913')).toEqual({ short_code: '482913' });
  });

  it('trims whitespace around a short code', () => {
    expect(checkInPayload('  482913 ')).toEqual({ short_code: '482913' });
  });

  it('sends anything else as a rotating token', () => {
    expect(checkInPayload('evt-123.4.abcdef')).toEqual({ token: 'evt-123.4.abcdef' });
  });

  it('treats 5 or 7 digits as a token, not a short code', () => {
    expect(checkInPayload('12345')).toEqual({ token: '12345' });
    expect(checkInPayload('1234567')).toEqual({ token: '1234567' });
  });
});
