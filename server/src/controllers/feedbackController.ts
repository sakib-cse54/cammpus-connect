import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { db } from '../db/index.js';
import { logAudit } from '../middleware/audit.js';
import { nowIso } from '../utils/time.js';
import { HttpError, validate } from '../utils/http.js';

export const submitFeedbackSchema = z.object({
  rating: z.coerce.number().int('Rating must be an integer').min(1, 'Rating must be between 1 and 5').max(5, 'Rating must be between 1 and 5'),
  comments: z.string().trim().max(2000, 'Comments cannot exceed 2000 characters').optional().nullable(),
  is_anonymous: z.boolean().optional().default(false)
});

export class FeedbackController {
  public static async submitFeedback(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      throw new HttpError(401, 'Unauthorized');
    }

    const eventId = String(req.params.eventId);
    const { rating, comments, is_anonymous } = validate(submitFeedbackSchema, req.body);
    const userId = req.user.userId;

    const event = await db.queryOne<{ id: string }>('SELECT id FROM events WHERE id = $1', [eventId]);
    if (!event) {
      throw new HttpError(404, 'Event not found');
    }

    // Verify attendance
    const attendance = await db.queryOne<{ id: string }>(
      'SELECT id FROM attendance_records WHERE event_id = $1 AND user_id = $2',
      [eventId, userId]
    );

    if (!attendance) {
      throw new HttpError(403, 'Feedback is only allowed for verified attendees');
    }

    // Check duplicate and insert atomically
    const feedbackId = uuidv4();
    const inserted = await db.execute(
      `INSERT INTO feedback (id, event_id, user_id, rating, comments, is_anonymous, submitted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (event_id, user_id) DO NOTHING`,
      [feedbackId, eventId, userId, rating, comments || null, is_anonymous ? 1 : 0, nowIso()]
    );

    if (inserted.rowCount === 0) {
      throw new HttpError(409, 'Feedback already submitted for this event');
    }

    await logAudit(userId, 'EVENT_FEEDBACK_SUBMITTED', 'feedback', feedbackId, { eventId, rating }, req.ip);

    res.status(201).json({ message: 'Thank you! Your feedback has been recorded', feedbackId });
  }

  public static async getEventFeedback(req: Request, res: Response): Promise<void> {
    const eventId = String(req.params.eventId);
    const event = await db.queryOne<{ id: string }>('SELECT id FROM events WHERE id = $1', [eventId]);
    if (!event) {
      throw new HttpError(404, 'Event not found');
    }

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
  }
}
