import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { logAudit } from '../middleware/audit.js';
import { nowIso } from '../utils/time.js';

export class FeedbackController {
  public static async submitFeedback(req: Request, res: Response): Promise<void> {
    try {
      const eventId = String(req.params.eventId);
      const { rating, comments, is_anonymous } = req.body;
      const userId = req.user!.userId;

      if (!rating || rating < 1 || rating > 5) {
        res.status(400).json({ error: 'Rating must be an integer between 1 and 5' });
        return;
      }

      // Verify attendance
      const attendance = await db.queryOne(
        'SELECT id FROM attendance_records WHERE event_id = $1 AND user_id = $2',
        [eventId, userId]
      );

      if (!attendance) {
        res.status(403).json({ error: 'Feedback is only allowed for verified attendees' });
        return;
      }

      // Check duplicate
      const existing = await db.queryOne('SELECT id FROM feedback WHERE event_id = $1 AND user_id = $2', [eventId, userId]);
      if (existing) {
        res.status(409).json({ error: 'Feedback already submitted for this event' });
        return;
      }

      const feedbackId = uuidv4();
      await db.execute(
        `INSERT INTO feedback (id, event_id, user_id, rating, comments, is_anonymous, submitted_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [feedbackId, eventId, userId, rating, comments || null, is_anonymous ? 1 : 0, nowIso()]
      );

      await logAudit(userId, 'EVENT_FEEDBACK_SUBMITTED', 'feedback', feedbackId, { eventId, rating }, req.ip);

      res.status(201).json({ message: 'Thank you! Your feedback has been recorded' });
    } catch (err: unknown) {
      console.error('Failed to submit feedback', err);
      res.status(500).json({ error: 'Failed to submit feedback' });
    }
  }

  public static async getEventFeedback(req: Request, res: Response): Promise<void> {
    try {
      const eventId = String(req.params.eventId);
      const feedback = await db.query(`
        SELECT f.id, f.rating, f.comments, f.submitted_at,
               CASE WHEN f.is_anonymous = 1 THEN 'Anonymous Attendee' ELSE p.full_name END as submitter_name
        FROM feedback f
        LEFT JOIN users u ON f.user_id = u.id
        LEFT JOIN student_profiles p ON u.id = p.user_id
        WHERE f.event_id = $1
        ORDER BY f.submitted_at DESC
      `, [eventId]);

      const avgRow = await db.queryOne<{ avg_rating: number | null; count: number }>(
        'SELECT AVG(rating) as avg_rating, COUNT(*) as count FROM feedback WHERE event_id = $1',
        [eventId]
      );

      res.json({
        average_rating: avgRow?.avg_rating ? Number(avgRow.avg_rating.toFixed(2)) : 0,
        total_responses: avgRow?.count || 0,
        feedback
      });
    } catch (err: unknown) {
      console.error('Failed to retrieve feedback', err);
      res.status(500).json({ error: 'Failed to retrieve feedback' });
    }
  }
}
