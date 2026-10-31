import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { db } from '../db/index.js';
import { JWT_SECRET, JWT_REFRESH_SECRET, JWT_ALGORITHMS } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';
import { clearRateLimit } from '../middleware/rateLimiter.js';
import { User, StudentProfile, AuthTokenPayload } from '../types/index.js';
import { nowIso } from '../utils/time.js';
import { env } from '../config/env.js';
import { HttpError } from '../utils/http.js';

const registerSchema = z.object({
  email: z.string().email().refine((val) => val.includes('@'), {
    message: 'Institutional email address required'
  }),
  password: z.string().min(8, 'Password must be at least 8 characters long')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character'),
  full_name: z.string().min(2, 'Full name required'),
  student_id_number: z.string().min(3, 'Student ID number required'),
  department: z.string().min(2, 'Department required'),
  batch_year: z.number().int().min(2015).max(2035),
  phone_number: z.string().optional()
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

const updateUserSchema = z.object({
  role: z.enum(['STUDENT', 'CLUB_EXECUTIVE', 'FACULTY_ADVISOR', 'ADMIN']).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional()
});

const refreshClaimsSchema = z.object({ userId: z.string().min(1), tv: z.number().int().min(0) });
type RefreshClaims = z.infer<typeof refreshClaimsSchema>;

const ACCESS_TTL_MS = 15 * 60 * 1000;
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function cookieOptions(maxAge: number): { httpOnly: true; secure: boolean; sameSite: 'strict'; maxAge: number } {
  return { httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: 'strict', maxAge };
}

/** Synchronously verifies a refresh JWT; null when invalid, expired or lacking claims. */
function readRefreshClaims(token: string): RefreshClaims | null {
  try {
    const decoded: unknown = jwt.verify(token, JWT_REFRESH_SECRET, { algorithms: JWT_ALGORITHMS });
    const parsed = refreshClaimsSchema.safeParse(decoded);
    return parsed.success ? parsed.data : null;
  } catch {
    // Invalid or expired tokens are an expected client condition, not a server error.
    return null;
  }
}

/** Invalidates every refresh token issued to the user so far. */
export async function bumpTokenVersion(userId: string): Promise<void> {
  await db.execute('UPDATE users SET token_version = token_version + 1 WHERE id = $1', [userId]);
}

async function buildTokenPayload(user: User): Promise<AuthTokenPayload> {
  const profile = await db.queryOne<StudentProfile>(
    'SELECT full_name, student_id_number FROM student_profiles WHERE user_id = $1', [user.id]);
  return {
    userId: user.id,
    email: user.email,
    role: user.role,
    fullName: profile?.full_name || user.email.split('@')[0],
    studentIdNumber: profile?.student_id_number
  };
}

function issueAccessCookie(res: Response, payload: AuthTokenPayload): string {
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '15m', algorithm: 'HS256' });
  res.cookie('access_token', token, cookieOptions(ACCESS_TTL_MS));
  return token;
}

export class AuthController {
  public static async register(req: Request, res: Response): Promise<void> {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({
        error: 'Validation failed',
        issues: parsed.error.issues.map((i) => i.message)
      });
      return;
    }

    const { email, password, full_name, student_id_number, department, batch_year, phone_number } = parsed.data;

    const existingUser = await db.queryOne<User>('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser) {
      res.status(409).json({ error: 'Conflict: An account with this email already exists' });
      return;
    }

    const existingStudent = await db.queryOne<StudentProfile>(
      'SELECT id FROM student_profiles WHERE student_id_number = $1',
      [student_id_number]
    );
    if (existingStudent) {
      res.status(409).json({ error: 'Conflict: An account with this student ID already exists' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const userId = uuidv4();
    const profileId = uuidv4();

    await db.transaction(async (trx) => {
      await trx.execute(
        `INSERT INTO users (id, email, password_hash, role, status, created_at, updated_at)
         VALUES ($1, $2, $3, 'STUDENT', 'ACTIVE', $4, $4)`,
        [userId, email, passwordHash, nowIso()]
      );

      await trx.execute(
        `INSERT INTO student_profiles (id, user_id, student_id_number, full_name, department, batch_year, phone_number)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [profileId, userId, student_id_number, full_name, department, batch_year, phone_number || null]
      );
    });

    await logAudit(userId, 'USER_REGISTERED', 'users', userId, { email, student_id_number }, req.ip);

    res.status(201).json({
      message: 'Account successfully registered',
      user: {
        id: userId,
        email,
        role: 'STUDENT',
        full_name,
        student_id_number
      }
    });
  }

  public static async login(req: Request, res: Response): Promise<void> {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Email and password required' });
      return;
    }

    const { email, password } = parsed.data;
    const user = await db.queryOne<User>('SELECT * FROM users WHERE email = $1', [email]);

    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    if (user.status === 'SUSPENDED') {
      res.status(403).json({ error: 'Account suspended. Contact administration.' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    clearRateLimit(req);

    const profile = await db.queryOne<StudentProfile>(
      'SELECT full_name, student_id_number FROM student_profiles WHERE user_id = $1',
      [user.id]
    );

    const payload: AuthTokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      fullName: profile?.full_name || user.email.split('@')[0],
      studentIdNumber: profile?.student_id_number
    };

    const accessToken = issueAccessCookie(res, payload);
    const refreshToken = jwt.sign({ userId: user.id, tv: Number(user.token_version ?? 0) }, JWT_REFRESH_SECRET, { expiresIn: '7d', algorithm: 'HS256' });
    res.cookie('refresh_token', refreshToken, cookieOptions(REFRESH_TTL_MS));

    await logAudit(user.id, 'USER_LOGIN', 'users', user.id, undefined, req.ip);

    res.json({
      message: 'Authentication successful',
      token: accessToken,
      user: payload
    });
  }

  /** POST /auth/refresh: refresh token must carry the user's current token_version. */
  public static async refresh(req: Request, res: Response): Promise<void> {
    const raw: unknown = req.cookies?.refresh_token ?? req.body?.refresh_token;
    if (typeof raw !== 'string' || raw.length === 0) {
      res.status(401).json({ error: 'Refresh token required' });
      return;
    }
    const claims = readRefreshClaims(raw);
    if (!claims) throw new HttpError(403, 'Invalid or expired refresh token');
    const user = await db.queryOne<User>('SELECT * FROM users WHERE id = $1', [claims.userId]);
    if (!user || user.status === 'SUSPENDED') throw new HttpError(403, 'User account invalid or suspended');
    if (Number(user.token_version ?? 0) !== claims.tv) throw new HttpError(403, 'Refresh token has been revoked', undefined, 'TOKEN_REVOKED');
    const payload = await buildTokenPayload(user);
    const token = issueAccessCookie(res, payload);
    res.json({ token, user: payload });
  }

  /** POST /auth/logout: clears cookies and revokes every refresh token of the user. */
  public static async logout(req: Request, res: Response): Promise<void> {
    const raw: unknown = req.cookies?.refresh_token ?? req.body?.refresh_token;
    const claims = typeof raw === 'string' && raw ? readRefreshClaims(raw) : null;
    const userId = req.user?.userId ?? claims?.userId;
    if (userId) {
      await bumpTokenVersion(userId);
      await logAudit(userId, 'USER_LOGOUT', 'users', userId, undefined, req.ip);
    }
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    res.json({ message: 'Logged out successfully' });
  }

  public static async me(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const user = await db.queryOne<User>('SELECT id, email, role, status FROM users WHERE id = $1', [req.user.userId]);
    const profile = await db.queryOne<StudentProfile>('SELECT * FROM student_profiles WHERE user_id = $1', [req.user.userId]);

    // Fetch user club memberships
    const memberships = await db.query(
      `SELECT m.*, c.name as club_name, c.slug as club_slug, c.logo_url
       FROM club_memberships m
       JOIN clubs c ON m.club_id = c.id
       WHERE m.user_id = $1 AND m.status = 'APPROVED'`,
      [req.user.userId]
    );

    res.json({
      user,
      profile,
      memberships
    });
  }

  public static async getAllUsers(_req: Request, res: Response): Promise<void> {
    const users = await db.query(`
      SELECT u.id, u.email, u.role, u.status, u.created_at,
             p.student_id_number, p.full_name, p.department, p.batch_year
      FROM users u
      LEFT JOIN student_profiles p ON u.id = p.user_id
      ORDER BY u.created_at DESC
    `);
    res.json({ users });
  }

  /** PATCH /auth/users/:id/role: also revokes the user's refresh tokens. */
  public static async updateUserRole(req: Request, res: Response): Promise<void> {
    const id = String(req.params.id);
    const parsed = updateUserSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new HttpError(400, 'Validation failed', parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })), 'VALIDATION_ERROR');
    }
    const { role, status } = parsed.data;
    const entries = [['role', role], ['status', status]].filter((e): e is [string, string] => typeof e[1] === 'string');
    if (entries.length === 0) throw new HttpError(400, 'No update parameters provided');
    const sets = entries.map(([c], i) => `${c} = $${i + 2}`).join(', ');
    const params: unknown[] = [id, ...entries.map(([, v]) => v), nowIso()];
    const result = await db.execute(
      `UPDATE users SET ${sets}, token_version = token_version + 1, updated_at = $${entries.length + 2} WHERE id = $1`, params);
    if (result.rowCount === 0) throw new HttpError(404, 'User not found');
    await logAudit(req.user?.userId || null, 'USER_ROLE_UPDATED', 'users', id, { role, status }, req.ip);
    res.json({ message: 'User role updated successfully' });
  }
}
