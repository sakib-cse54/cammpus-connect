import { Request, Response, NextFunction, RequestHandler } from 'express';
import { env } from '../config/env.js';

/**
 * Bounded sliding-window counter. Each key keeps the timestamps of its hits
 * inside the window; expired hits and empty keys are evicted on access and
 * on periodic sweeps, and the oldest keys are dropped once maxKeys is hit.
 */
export class SlidingWindowLimiter {
  private readonly hits = new Map<string, readonly number[]>();
  private lastSweep = 0;

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly maxKeys = 10_000
  ) {}

  /** Records a hit and returns the seconds to wait, or 0 when allowed. */
  public hit(key: string, now: number = Date.now()): number {
    this.sweep(now);
    const recent = this.recent(key, now);
    if (recent.length >= this.limit) {
      return Math.max(1, Math.ceil((recent[0] + this.windowMs - now) / 1000));
    }
    this.hits.delete(key); // re-insert so Map order tracks recency
    this.hits.set(key, [...recent, now]);
    this.enforceBound();
    return 0;
  }

  public reset(key: string): void {
    this.hits.delete(key);
  }

  public size(): number {
    return this.hits.size;
  }

  private recent(key: string, now: number): readonly number[] {
    return (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
  }

  private sweep(now: number): void {
    if (now - this.lastSweep < this.windowMs / 4) return;
    this.lastSweep = now;
    for (const [key, times] of this.hits) {
      if (times.every((t) => now - t >= this.windowMs)) this.hits.delete(key);
    }
  }

  private enforceBound(): void {
    while (this.hits.size > this.maxKeys) {
      const oldest = this.hits.keys().next().value;
      if (oldest === undefined) return;
      this.hits.delete(oldest);
    }
  }
}

const WINDOW_MS = 15 * 60 * 1000;
const perAccount = new SlidingWindowLimiter(5, WINDOW_MS);
const perIp = new SlidingWindowLimiter(30, WINDOW_MS);

function clientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function accountKey(req: Request): string {
  const email: unknown = req.body?.email;
  return `${clientIp(req)}:${typeof email === 'string' ? email.toLowerCase() : ''}`;
}

function reject(res: Response, retryAfter: number): void {
  res.set('Retry-After', String(retryAfter));
  res.status(429).json({
    error: 'Too Many Requests: Rate limit exceeded. Please try again later.',
    retryAfterSeconds: retryAfter
  });
}

export function authRateLimiter(req: Request, res: Response, next: NextFunction): void {
  if (env.NODE_ENV === 'test') return next();
  const ipWait = perIp.hit(clientIp(req));
  if (ipWait > 0) return reject(res, ipWait);
  const accountWait = perAccount.hit(accountKey(req));
  if (accountWait > 0) return reject(res, accountWait);
  next();
}

export function clearRateLimit(req: Request): void {
  perAccount.reset(accountKey(req));
}

/** Light per-IP limiter for public endpoints (e.g. certificate verification). */
export function ipRateLimiter(limit: number, windowMs: number): RequestHandler {
  const limiter = new SlidingWindowLimiter(limit, windowMs);
  return (req, res, next) => {
    if (env.NODE_ENV === 'test') return next();
    const wait = limiter.hit(clientIp(req));
    if (wait > 0) return reject(res, wait);
    next();
  };
}
