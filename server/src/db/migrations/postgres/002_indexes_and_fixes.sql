-- 002_indexes_and_fixes: cancellation reason for events plus indexes for (PostgreSQL port)
-- the hottest lookups (attendance per event, unread notifications,
-- memberships per user, feedback per event).

ALTER TABLE events ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_attendance_event ON attendance_records(event_id);
CREATE INDEX IF NOT EXISTS idx_attendance_user ON attendance_records(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON club_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_event ON feedback(event_id);
CREATE INDEX IF NOT EXISTS idx_announcements_club ON announcements(club_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
