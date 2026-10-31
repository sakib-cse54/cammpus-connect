import { Request, Response } from 'express';
import { db } from '../db/index.js';

export class AnalyticsController {
  public static async getAdminDashboard(_req: Request, res: Response): Promise<void> {
    const userCounts = await db.queryOne(`
      SELECT 
        COUNT(*) as total_users,
        SUM(CASE WHEN role = 'STUDENT' THEN 1 ELSE 0 END) as students,
        SUM(CASE WHEN role = 'CLUB_EXECUTIVE' THEN 1 ELSE 0 END) as executives,
        SUM(CASE WHEN role = 'FACULTY_ADVISOR' THEN 1 ELSE 0 END) as advisors
      FROM users
    `);

    const clubCount = await db.queryOne('SELECT COUNT(*) as total_clubs FROM clubs WHERE status = \'ACTIVE\'');
    const eventCounts = await db.queryOne(`
      SELECT 
        COUNT(*) as total_events,
        SUM(CASE WHEN status = 'PUBLISHED' THEN 1 ELSE 0 END) as published_events,
        SUM(CASE WHEN status = 'PENDING_APPROVAL' THEN 1 ELSE 0 END) as pending_events
      FROM events
    `);

    const registrationCount = await db.queryOne(`
      SELECT 
        COUNT(*) as total_registrations,
        SUM(CASE WHEN status = 'ATTENDED' THEN 1 ELSE 0 END) as attended_count
      FROM registrations
    `);

    const certCount = await db.queryOne('SELECT COUNT(*) as total_certificates FROM certificates WHERE status = \'VALID\'');

    // Recent audit logs
    const recentAudit = await db.query(`
      SELECT a.*, u.email as actor_email
      FROM audit_logs a
      LEFT JOIN users u ON a.actor_id = u.id
      ORDER BY a.timestamp DESC LIMIT 15
    `);

    res.json({
      metrics: {
        users: userCounts,
        clubs: clubCount?.total_clubs || 0,
        events: eventCounts,
        registrations: registrationCount,
        certificates: certCount?.total_certificates || 0
      },
      recent_audit_logs: recentAudit
    });
  }

  public static async getClubExecutiveDashboard(req: Request, res: Response): Promise<void> {
    const clubId = String(req.params.clubId);

    const memberCount = await db.queryOne(
      `SELECT COUNT(*) as count FROM club_memberships WHERE club_id = $1 AND status = 'APPROVED'`,
      [clubId]
    );

    const pendingMembers = await db.queryOne(
      `SELECT COUNT(*) as count FROM club_memberships WHERE club_id = $1 AND status = 'PENDING'`,
      [clubId]
    );

    const eventStats = await db.queryOne(`
      SELECT 
        COUNT(*) as total_events,
        SUM(registered_count) as total_signups
      FROM events WHERE club_id = $1
    `, [clubId]);

    const attendanceCount = await db.queryOne(`
      SELECT COUNT(*) as count 
      FROM attendance_records a
      JOIN events e ON a.event_id = e.id
      WHERE e.club_id = $1
    `, [clubId]);

    res.json({
      members: memberCount?.count || 0,
      pending_applications: pendingMembers?.count || 0,
      events: eventStats?.total_events || 0,
      total_signups: eventStats?.total_signups || 0,
      total_attendance: attendanceCount?.count || 0
    });
  }
}
