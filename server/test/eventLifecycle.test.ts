import { describe, it, expect } from 'vitest';
import { ALL_EVENT_STATUSES, canTransition } from '../src/services/eventLifecycle.js';
import { SlidingWindowLimiter } from '../src/middleware/rateLimiter.js';
import { csvCell } from '../src/utils/csv.js';
import { toBase32 } from '../src/services/certificateService.js';
import { EventStatus } from '../src/types/index.js';

const ALLOWED = new Set([
  'DRAFT>PENDING_APPROVAL', 'DRAFT>CANCELLED',
  'PENDING_APPROVAL>PUBLISHED', 'PENDING_APPROVAL>REJECTED', 'PENDING_APPROVAL>CANCELLED',
  'REJECTED>PENDING_APPROVAL',
  'PUBLISHED>CANCELLED', 'PUBLISHED>COMPLETED'
]);

describe('event lifecycle transition table', () => {
  const pairs: [EventStatus, EventStatus][] = ALL_EVENT_STATUSES.flatMap((from) =>
    ALL_EVENT_STATUSES.map((to): [EventStatus, EventStatus] => [from, to]));

  it.each(pairs)('%s -> %s matches the specification', (from, to) => {
    expect(canTransition(from, to)).toBe(ALLOWED.has(`${from}>${to}`));
  });
});

describe('SlidingWindowLimiter', () => {
  it('allows up to the limit then reports a wait, and recovers after the window', () => {
    const l = new SlidingWindowLimiter(2, 1000);
    expect(l.hit('a', 0)).toBe(0);
    expect(l.hit('a', 100)).toBe(0);
    expect(l.hit('a', 200)).toBeGreaterThan(0);
    expect(l.hit('a', 1001)).toBe(0);
  });

  it('evicts expired keys and stays bounded', () => {
    const l = new SlidingWindowLimiter(5, 1000, 3);
    ['a', 'b', 'c', 'd', 'e'].forEach((k) => l.hit(k, 0));
    expect(l.size()).toBe(3);
    l.hit('z', 5000);
    expect(l.size()).toBe(1);
  });
});

describe('csvCell', () => {
  it('neutralizes formulas and doubles quotes', () => {
    expect(csvCell('=HYPERLINK("http://x")')).toBe('"\'=HYPERLINK(""http://x"")"');
    expect(csvCell('+1')).toBe('"\'+1"');
    expect(csvCell('-1')).toBe('"\'-1"');
    expect(csvCell('@SUM(A1)')).toBe('"\'@SUM(A1)"');
    expect(csvCell(null)).toBe('""');
    expect(csvCell('Rahim')).toBe('"Rahim"');
  });
});

describe('toBase32', () => {
  it('matches RFC 4648 vectors', () => {
    expect(toBase32(Buffer.from('foobar'))).toBe('MZXW6YTBOI');
    expect(toBase32(Buffer.from('f'))).toBe('MY');
    expect(toBase32(Buffer.alloc(16)).length).toBe(26);
  });
});
