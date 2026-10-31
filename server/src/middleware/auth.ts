import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db/index.js';
import { AuthTokenPayload, UserRole } from '../types/index.js';
import { ClubAccess, getClubAccess, getEventClubId } from '../services/clubAccess.js';
import { env } from '../config/env.js';

export const JWT_SECRET = env.JWT_SECRET;
export const JWT_REFRESH_SECRET = env.JWT_REFRESH_SECRET;
/** Only HMAC-SHA256 is accepted; blocks alg confusion (none, RS/HS swaps). */
export const JWT_ALGORITHMS: jwt.Algorithm[] = ['HS256'];

function isAuthPayload(value: unknown): value is AuthTokenPayload {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.userId === 'string' && typeof v.role === 'string' && typeof v.email === 'string';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
    }
  }
}

export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  const token = readToken(req);

  if (!token) {
    res.status(401).json({ error: 'Unauthorized: Authentication token required' });
    return;
  }

  try {
    const decoded: unknown = jwt.verify(token, JWT_SECRET, { algorithms: JWT_ALGORITHMS });
    if (!isAuthPayload(decoded)) {
      res.status(401).json({ error: 'Unauthorized: Invalid token payload', code: 'TOKEN_INVALID' });
      return;
    }
    req.user = decoded;
    next();
  } catch (err) {
    // 401 (not 403) so the client knows to refresh and retry
    const expired = err instanceof jwt.TokenExpiredError;
    res.status(401).json({
      error: expired ? 'Unauthorized: Token expired' : 'Unauthorized: Invalid token',
      code: expired ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID'
    });
  }
}

export function requireRoles(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized: User not authenticated' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: `Forbidden: Insufficient permissions. Required one of: ${roles.join(', ')}`
      });
      return;
    }

    next();
  };
}

function readToken(req: Request): string | undefined {
  const authHeader = req.headers['authorization'];
  const bearer = authHeader ? authHeader.split(' ')[1] : undefined;
  const cookie: unknown = req.cookies?.access_token;
  return bearer || (typeof cookie === 'string' ? cookie : undefined);
}

/** Attaches req.user when a valid token is present; never rejects the request. */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = readToken(req);
  if (!token) return next();
  try {
    const decoded: unknown = jwt.verify(token, JWT_SECRET, { algorithms: JWT_ALGORITHMS });
    if (isAuthPayload(decoded)) req.user = decoded;
  } catch {
    // Anonymous access is fine; an invalid token simply yields no user.
  }
  next();
}

function pickClubId(req: Request): string | undefined {
  // An authorized URL param always wins; body/query never override it.
  if (typeof req.params.clubId === 'string' && req.params.clubId) return req.params.clubId;
  const fromBody: unknown = req.body?.club_id;
  if (typeof fromBody === 'string' && fromBody) return fromBody;
  const fromQuery: unknown = req.query.club_id;
  return typeof fromQuery === 'string' && fromQuery ? fromQuery : undefined;
}

/** Requires ADMIN, the club advisor, or an APPROVED executive/president/treasurer of the club. */
export async function requireClubExecutive(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const clubId = pickClubId(req);
  if (!clubId) {
    res.status(400).json({ error: 'Club ID must be specified for permission check' });
    return;
  }
  try {
    const club = await db.queryOne<{ id: string }>('SELECT id FROM clubs WHERE id = $1', [clubId]);
    if (!club) {
      res.status(404).json({ error: 'Club not found' });
      return;
    }
    const access = await getClubAccess(req.user, clubId);
    if (!access) {
      res.status(403).json({ error: 'Forbidden: You are not an authorized executive of this club' });
      return;
    }
    res.locals.clubAccess = access;
    next();
  } catch (err) {
    console.error('Club authorization check failed:', err);
    res.status(500).json({ error: 'Failed to verify club authorization' });
  }
}

/**
 * Loads the club owning :eventId (or :id) and requires club management
 * access: ADMIN, the club's faculty advisor, or an APPROVED executive.
 * Sets res.locals.eventClubId and res.locals.clubAccess.
 */
export function requireEventClubRole(allowed: readonly Exclude<ClubAccess, null>[] = ['ADMIN', 'ADVISOR', 'EXECUTIVE']) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const eventId = String(req.params.eventId ?? req.params.id ?? '');
    try {
      const clubId = eventId ? await getEventClubId(eventId) : null;
      if (!clubId) {
        res.status(404).json({ error: 'Event not found' });
        return;
      }
      const access = await getClubAccess(req.user, clubId);
      if (!access || !allowed.includes(access)) {
        res.status(403).json({ error: 'Forbidden: You do not manage the club hosting this event' });
        return;
      }
      res.locals.eventClubId = clubId;
      res.locals.clubAccess = access;
      next();
    } catch (err) {
      console.error('Event club authorization check failed:', err);
      res.status(500).json({ error: 'Failed to verify club authorization' });
    }
  };
}
