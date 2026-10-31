import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { logAudit } from '../middleware/audit.js';
import { nowIso } from '../utils/time.js';
import { HttpError, validate } from '../utils/http.js';
import { z } from 'zod';

const announcementSchema = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(5000)
});

export class AnnouncementController {
  public static async createAnnouncement(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new HttpError(401, 'Unauthorized');
    // The club comes only from the authorized URL param; body.club_id is ignored.
    const clubId = String(req.params.clubId);
    const club = await db.queryOne<{ id: string }>('SELECT id FROM clubs WHERE id = $1', [clubId]);
    if (!club) throw new HttpError(404, 'Club not found');

    const { title, content } = validate(announcementSchema, req.body);
    const authorId = req.user.userId;
    const announcementId = uuidv4();
    const createdAt = nowIso();

    const notified = await db.transaction(async (trx) => {
      await trx.execute(
        `INSERT INTO announcements (id, club_id, author_id, title, content, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [announcementId, clubId, authorId, title, content, createdAt]
      );
      const members = await trx.query<{ user_id: string }>(
        `SELECT user_id FROM club_memberships WHERE club_id = $1 AND status = 'APPROVED'`,
        [clubId]
      );
      for (const m of members) {
        await trx.execute(
          `INSERT INTO notifications (id, user_id, title, message, link_url, is_read, created_at)
           VALUES ($1, $2, $3, $4, $5, 0, $6)`,
          [uuidv4(), m.user_id, title, content.substring(0, 150), `/clubs/${clubId}`, createdAt]
        );
      }
      return members.length;
    });

    await logAudit(authorId, 'ANNOUNCEMENT_PUBLISHED', 'announcements', announcementId, { club_id: clubId, title, notified }, req.ip);
    res.status(201).json({ message: 'Announcement broadcasted successfully', announcementId });
  }

  public static async getClubAnnouncements(req: Request, res: Response): Promise<void> {
    const clubId = String(req.params.clubId);
    const club = await db.queryOne<{ id: string }>('SELECT id FROM clubs WHERE id = $1 OR slug = $1', [clubId]);
    if (!club) throw new HttpError(404, 'Club not found');

    const announcements = await db.query(`
      SELECT a.*, p.full_name as author_name, c.name as club_name
      FROM announcements a
      JOIN clubs c ON a.club_id = c.id
      LEFT JOIN users u ON a.author_id = u.id
      LEFT JOIN student_profiles p ON u.id = p.user_id
      WHERE a.club_id = $1
      ORDER BY a.created_at DESC
    `, [club.id]);

    res.json({ announcements });
  }

  public static async getUserNotifications(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new HttpError(401, 'Unauthorized');
    const userId = req.user.userId;

    const notifications = await db.query(`
      SELECT * FROM notifications 
      WHERE user_id = $1 
      ORDER BY created_at DESC LIMIT 30
    `, [userId]);

    const unreadCount = await db.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = 0',
      [userId]
    );

    res.json({
      unread_count: unreadCount?.count || 0,
      notifications
    });
  }

  public static async markNotificationRead(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new HttpError(401, 'Unauthorized');
    const id = String(req.params.id);
    const userId = req.user.userId;

    const result = await db.execute('UPDATE notifications SET is_read = 1 WHERE id = $1 AND user_id = $2', [id, userId]);
    if (result.rowCount === 0) {
      const exists = await db.queryOne('SELECT id FROM notifications WHERE id = $1', [id]);
      if (!exists) throw new HttpError(404, 'Notification not found');
      throw new HttpError(403, 'Forbidden: You do not own this notification');
    }
    res.json({ message: 'Notification marked as read' });
  }
}
