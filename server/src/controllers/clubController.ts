import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { logAudit } from '../middleware/audit.js';
import { Club, ClubMembership } from '../types/index.js';
import { nowIso } from '../utils/time.js';
import { HttpError, validate } from '../utils/http.js';
import { EXECUTIVE_CLUB_ROLES, getClubAccess } from '../services/clubAccess.js';
import { z } from 'zod';

export class ClubController {
  public static async getClubs(req: Request, res: Response): Promise<void> {
    try {
      const clubs = await db.query(`
        SELECT c.*, 
               u.email as advisor_email,
               p.full_name as advisor_name,
               (SELECT COUNT(*) FROM club_memberships m WHERE m.club_id = c.id AND m.status = 'APPROVED') as member_count,
               (SELECT COUNT(*) FROM events e WHERE e.club_id = c.id AND e.status = 'PUBLISHED') as active_event_count
        FROM clubs c
        LEFT JOIN users u ON c.faculty_advisor_id = u.id
        LEFT JOIN student_profiles p ON u.id = p.user_id
        WHERE c.status = 'ACTIVE'
        ORDER BY c.name ASC
      `);
      res.json({ clubs });
    } catch (err: unknown) {
      console.error('Failed to fetch club directory', err);
      res.status(500).json({ error: 'Failed to fetch club directory' });
    }
  }

  public static async getClubByIdOrSlug(req: Request, res: Response): Promise<void> {
    try {
      const idOrSlug = String(req.params.idOrSlug);
      const club = await db.queryOne(`
        SELECT c.*, 
               u.email as advisor_email,
               p.full_name as advisor_name,
               (SELECT COUNT(*) FROM club_memberships m WHERE m.club_id = c.id AND m.status = 'APPROVED') as member_count
        FROM clubs c
        LEFT JOIN users u ON c.faculty_advisor_id = u.id
        LEFT JOIN student_profiles p ON u.id = p.user_id
        WHERE c.id = $1 OR c.slug = $1
      `, [idOrSlug]);

      if (!club) {
        res.status(404).json({ error: 'Club not found' });
        return;
      }

      // Fetch executive committee
      const executives = await db.query(`
        SELECT m.club_role, m.joined_at, p.full_name
        FROM club_memberships m
        JOIN users u ON m.user_id = u.id
        LEFT JOIN student_profiles p ON u.id = p.user_id
        WHERE m.club_id = $1 AND m.status = 'APPROVED' AND m.club_role != 'MEMBER'
        ORDER BY m.club_role ASC
      `, [club.id]);

      // Fetch active published events
      const events = await db.query(`
        SELECT * FROM events
        WHERE club_id = $1 AND status = 'PUBLISHED'
        ORDER BY start_time ASC
      `, [club.id]);

      res.json({ club, executives, events });
    } catch (err: unknown) {
      console.error('Failed to fetch club profile', err);
      res.status(500).json({ error: 'Failed to fetch club profile' });
    }
  }

  public static async createClub(req: Request, res: Response): Promise<void> {
    try {
      const { name, slug, description, category, logo_url, faculty_advisor_id } = req.body;
      if (!name || !slug || !description || !category || !faculty_advisor_id) {
        res.status(400).json({ error: 'Missing required club fields' });
        return;
      }

      const existing = await db.queryOne('SELECT id FROM clubs WHERE slug = $1 OR name = $2', [slug, name]);
      if (existing) {
        res.status(409).json({ error: 'A club with this name or slug already exists' });
        return;
      }

      const clubId = uuidv4();
      await db.execute(
        `INSERT INTO clubs (id, name, slug, description, category, logo_url, faculty_advisor_id, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE', $8)`,
        [clubId, name, slug, description, category, logo_url || null, faculty_advisor_id, nowIso()]
      );

      await logAudit(req.user?.userId || null, 'CLUB_CREATED', 'clubs', clubId, { name, slug }, req.ip);

      res.status(201).json({ message: 'Club created successfully', clubId });
    } catch (err: unknown) {
      console.error('Failed to create club', err);
      res.status(500).json({ error: 'Failed to create club' });
    }
  }

  public static async applyForMembership(req: Request, res: Response): Promise<void> {
    try {
      const clubId = String(req.params.clubId);
      const userId = req.user!.userId;

      const existing = await db.queryOne<ClubMembership>(
        'SELECT id, status FROM club_memberships WHERE club_id = $1 AND user_id = $2',
        [clubId, userId]
      );

      if (existing) {
        if (existing.status === 'APPROVED') {
          res.status(400).json({ error: 'You are already an active member of this club' });
          return;
        }
        if (existing.status === 'PENDING') {
          res.status(400).json({ error: 'Your membership application is already pending review' });
          return;
        }
        // If previously REJECTED, reset status to PENDING
        await db.execute(
          `UPDATE club_memberships SET status = 'PENDING', club_role = 'MEMBER', joined_at = NULL WHERE id = $1`,
          [existing.id]
        );
        await logAudit(userId, 'CLUB_MEMBERSHIP_APPLIED', 'club_memberships', existing.id, { clubId, reapplied: true }, req.ip);
        res.status(200).json({ message: 'Membership application re-submitted successfully' });
        return;
      }

      const membershipId = uuidv4();
      await db.execute(
        `INSERT INTO club_memberships (id, club_id, user_id, club_role, status, joined_at)
         VALUES ($1, $2, $3, 'MEMBER', 'PENDING', NULL)`,
        [membershipId, clubId, userId]
      );

      await logAudit(userId, 'CLUB_MEMBERSHIP_APPLIED', 'club_memberships', membershipId, { clubId }, req.ip);

      res.status(201).json({ message: 'Membership application submitted successfully' });
    } catch (err: unknown) {
      console.error('Failed to submit application', err);
      res.status(500).json({ error: 'Failed to submit application' });
    }
  }

  public static async reviewMembership(req: Request, res: Response): Promise<void> {
    const clubId = String(req.params.clubId);
    const membershipId = String(req.params.membershipId);
    const reviewer = req.user!;
    const body = validate(reviewMembershipSchema, req.body);

    const membership = await db.queryOne<ClubMembership>(
      'SELECT * FROM club_memberships WHERE id = $1 AND club_id = $2',
      [membershipId, clubId]
    );
    if (!membership) throw new HttpError(404, 'Membership application not found');
    if (membership.user_id === reviewer.userId) {
      throw new HttpError(403, 'You cannot review your own membership');
    }
    if (membership.status !== 'PENDING') {
      throw new HttpError(409, `Only PENDING applications can be reviewed (current: ${membership.status})`);
    }
    const assignedRole = body.decision === 'APPROVED' ? body.role ?? 'MEMBER' : 'MEMBER';
    const access: unknown = res.locals.clubAccess;
    if (assignedRole === 'PRESIDENT' && access !== 'ADMIN' && access !== 'ADVISOR') {
      throw new HttpError(403, 'Only the club faculty advisor or an admin can appoint a president');
    }

    await applyMembershipReview(membership, body.decision, assignedRole);
    await logAudit(reviewer.userId, 'CLUB_MEMBERSHIP_REVIEWED', 'club_memberships', membershipId,
      { clubId, decision: body.decision, assignedRole }, req.ip);
    res.json({ message: `Membership application has been ${body.decision.toLowerCase()}` });
  }

  public static async getClubMembers(req: Request, res: Response): Promise<void> {
    const clubId = String(req.params.clubId);
    const access = await getClubAccess(req.user!, clubId);
    if (access) {
      const members = await db.query(`
        SELECT m.id as membership_id, m.club_role, m.status, m.joined_at,
               u.id as user_id, u.email,
               p.full_name, p.student_id_number, p.department, p.batch_year
        FROM club_memberships m
        JOIN users u ON m.user_id = u.id
        LEFT JOIN student_profiles p ON u.id = p.user_id
        WHERE m.club_id = $1
        ORDER BY CASE WHEN m.status = 'PENDING' THEN 1 ELSE 2 END, m.joined_at DESC
      `, [clubId]);
      res.json({ members, view: 'FULL' });
      return;
    }
    const members = await db.query(`
      SELECT p.full_name, m.club_role
      FROM club_memberships m
      LEFT JOIN student_profiles p ON m.user_id = p.user_id
      WHERE m.club_id = $1 AND m.status = 'APPROVED'
      ORDER BY m.club_role ASC, p.full_name ASC
    `, [clubId]);
    res.json({ members, view: 'PUBLIC' });
  }

  /** All events of a club in every status, for its executives, advisor and admins. */
  public static async getClubEvents(req: Request, res: Response): Promise<void> {
    const clubId = String(req.params.clubId);
    const events = await db.query(`
      SELECT e.*, c.name as club_name, c.slug as club_slug,
             (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status = 'WAITLISTED') as waitlist_count
      FROM events e
      JOIN clubs c ON e.club_id = c.id
      WHERE e.club_id = $1
      ORDER BY e.start_time DESC
    `, [clubId]);
    res.json({ events });
  }

  /** Clubs the caller manages: as approved executive/president/treasurer or as advisor. */
  public static async getMyClubs(req: Request, res: Response): Promise<void> {
    const userId = req.user!.userId;
    const clubs = await db.query(`
      SELECT c.id, c.name, c.slug, c.category, c.logo_url, m.club_role as role
      FROM club_memberships m
      JOIN clubs c ON c.id = m.club_id
      WHERE m.user_id = $1 AND m.status = 'APPROVED' AND m.club_role IN ('EXECUTIVE', 'PRESIDENT', 'TREASURER')
      UNION
      SELECT c.id, c.name, c.slug, c.category, c.logo_url, 'FACULTY_ADVISOR' as role
      FROM clubs c
      WHERE c.faculty_advisor_id = $1
      ORDER BY name ASC
    `, [userId]);
    res.json({ clubs });
  }
}

const reviewMembershipSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  role: z.enum(['MEMBER', 'EXECUTIVE', 'PRESIDENT', 'TREASURER']).optional()
});

async function applyMembershipReview(
  membership: ClubMembership,
  decision: 'APPROVED' | 'REJECTED',
  role: string
): Promise<void> {
  const joinedAt = decision === 'APPROVED' ? nowIso() : null;
  await db.transaction(async (trx) => {
    const updated = await trx.execute(
      `UPDATE club_memberships SET status = $1, club_role = $2, joined_at = $3
       WHERE id = $4 AND status = 'PENDING'`,
      [decision, role, joinedAt, membership.id]
    );
    if (updated.rowCount === 0) throw new HttpError(409, 'Membership was reviewed concurrently');
    if (decision === 'APPROVED' && (EXECUTIVE_CLUB_ROLES as readonly string[]).includes(role)) {
      await trx.execute(
        `UPDATE users SET role = 'CLUB_EXECUTIVE' WHERE id = $1 AND role = 'STUDENT'`,
        [membership.user_id]
      );
    }
  });
}
