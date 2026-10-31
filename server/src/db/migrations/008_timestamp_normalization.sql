-- 008_timestamp_normalization: rewrites legacy timestamps to canonical ISO 8601 UTC
-- ('YYYY-MM-DDTHH:MM:SS.sssZ') so string range comparisons are correct.
--  * Naive event schedule values ('2026-11-10 10:00:00', '2026-11-10T10:00') were
--    entered as Asia/Dhaka wall time (UTC+06:00, no DST): shifted by -6 hours.
--  * Naive server-generated values (created_at, check_in_time, ...) came from
--    SQLite datetime('now') / CURRENT_TIMESTAMP, which is UTC: reformatted only.
--  * Values with an explicit offset ('+06:00') are converted to UTC.
--  * Canonical values ending in 'Z' and NULLs are left untouched.
-- Also adds users.token_version for refresh-token revocation.

ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0;

-- Per column: offset values first, then naive values (so nothing is shifted twice).
UPDATE events SET start_time = strftime('%Y-%m-%dT%H:%M:%fZ', start_time)
  WHERE start_time GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][ T][0-9][0-9]:[0-9][0-9]*[+-][0-9][0-9]:[0-9][0-9]'
    AND strftime('%Y-%m-%dT%H:%M:%fZ', start_time) IS NOT NULL;
UPDATE events SET start_time = strftime('%Y-%m-%dT%H:%M:%fZ', start_time, '-6 hours')
  WHERE (start_time GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][ T][0-9][0-9]:[0-9][0-9]' OR start_time GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][ T][0-9][0-9]:[0-9][0-9]:[0-9][0-9]' OR start_time GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][ T][0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9]*[0-9]')
    AND strftime('%Y-%m-%dT%H:%M:%fZ', start_time, '-6 hours') IS NOT NULL;
UPDATE events SET end_time = strftime('%Y-%m-%dT%H:%M:%fZ', end_time)
  WHERE end_time GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][ T][0-9][0-9]:[0-9][0-9]*[+-][0-9][0-9]:[0-9][0-9]'
    AND strftime('%Y-%m-%dT%H:%M:%fZ', end_time) IS NOT NULL;
UPDATE events SET end_time = strftime('%Y-%m-%dT%H:%M:%fZ', end_time, '-6 hours')
  WHERE (end_time GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][ T][0-9][0-9]:[0-9][0-9]' OR end_time GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][ T][0-9][0-9]:[0-9][0-9]:[0-9][0-9]' OR end_time GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][ T][0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9]*[0-9]')
    AND strftime('%Y-%m-%dT%H:%M:%fZ', end_time, '-6 hours') IS NOT NULL;
UPDATE events SET registration_deadline = strftime('%Y-%m-%dT%H:%M:%fZ', registration_deadline)
  WHERE registration_deadline GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][ T][0-9][0-9]:[0-9][0-9]*[+-][0-9][0-9]:[0-9][0-9]'
    AND strftime('%Y-%m-%dT%H:%M:%fZ', registration_deadline) IS NOT NULL;
UPDATE events SET registration_deadline = strftime('%Y-%m-%dT%H:%M:%fZ', registration_deadline, '-6 hours')
  WHERE (registration_deadline GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][ T][0-9][0-9]:[0-9][0-9]' OR registration_deadline GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][ T][0-9][0-9]:[0-9][0-9]:[0-9][0-9]' OR registration_deadline GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][ T][0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9]*[0-9]')
    AND strftime('%Y-%m-%dT%H:%M:%fZ', registration_deadline, '-6 hours') IS NOT NULL;
UPDATE users SET created_at = strftime('%Y-%m-%dT%H:%M:%fZ', created_at)
  WHERE created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][ T][0-9][0-9]:[0-9][0-9]*[+-][0-9][0-9]:[0-9][0-9]'
    AND strftime('%Y-%m-%dT%H:%M:%fZ', created_at) IS NOT NULL;
UPDATE users SET created_at = strftime('%Y-%m-%dT%H:%M:%fZ', created_at)
  WHERE (created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][ T][0-9][0-9]:[0-9][0-9]' OR created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][ T][0-9][0-9]:[0-9][0-9]:[0-9][0-9]' OR created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][ T][0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9]*[0-9]')
    AND strftime('%Y-%m-%dT%H:%M:%fZ', created_at) IS NOT NULL;
UPDATE users SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', updated_at)
  WHERE updated_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][ T][0-9][0-9]:[0-9][0-9]*[+-][0-9][0-9]:[0-9][0-9]'
    AND strftime('%Y-%m-%dT%H:%M:%fZ', updated_at) IS NOT NULL;
UPDATE users SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', updated_at)
  WHERE (updated_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][ T][0-9][0-9]:[0-9][0-9]' OR updated_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][ T][0-9][0-9]:[0-9][0-9]:[0-9][0-9]' OR updated_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][ T][0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9]*[0-9]')
    AND strftime('%Y-%m-%dT%H:%M:%fZ', updated_at) IS NOT NULL;
UPDATE clubs SET created_at = strftime('%Y-%m-%dT%H:%M:%fZ', created_at)
  WHERE created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][ T][0-9][0-9]:[0-9][0-9]*[+-][0-9][0-9]:[0-9][0-9]'
    AND strftime('%Y-%m-%dT%H:%M:%fZ', created_at) IS NOT NULL;
UPDATE clubs SET created_at = strftime('%Y-%m-%dT%H:%M:%fZ', created_at)
  WHERE (created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][ T][0-9][0-9]:[0-9][0-9]' OR created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][ T][0-9][0-9]:[0-9][0-9]:[0-9][0-9]' OR created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][ T][0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9]*[0-9]')
    AND strftime('%Y-%m-%dT%H:%M:%fZ', created_at) IS NOT NULL;
UPDATE club_memberships SET joined_at = strftime('%Y-%m-%dT%H:%M:%fZ', joined_at)
  WHERE joined_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][ T][0-9][0-9]:[0-9][0-9]*[+-][0-9][0-9]:[0-9][0-9]'
    AND strftime('%Y-%m-%dT%H:%M:%fZ', joined_at) IS NOT NULL;
UPDATE club_memberships SET joined_at = strftime('%Y-%m-%dT%H:%M:%fZ', joined_at)
  WHERE (joined_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][ T][0-9][0-9]:[0-9][0-9]' OR joined_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][ T][0-9][0-9]:[0-9][0-9]:[0-9][0-9]' OR joined_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][ T][0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9]*[0-9]')
    AND strftime('%Y-%m-%dT%H:%M:%fZ', joined_at) IS NOT NULL;
UPDATE registrations SET created_at = strftime('%Y-%m-%dT%H:%M:%fZ', created_at)
  WHERE created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][ T][0-9][0-9]:[0-9][0-9]*[+-][0-9][0-9]:[0-9][0-9]'
    AND strftime('%Y-%m-%dT%H:%M:%fZ', created_at) IS NOT NULL;
UPDATE registrations SET created_at = strftime('%Y-%m-%dT%H:%M:%fZ', created_at)
  WHERE (created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][ T][0-9][0-9]:[0-9][0-9]' OR created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][ T][0-9][0-9]:[0-9][0-9]:[0-9][0-9]' OR created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][ T][0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9]*[0-9]')
    AND strftime('%Y-%m-%dT%H:%M:%fZ', created_at) IS NOT NULL;
UPDATE attendance_records SET check_in_time = strftime('%Y-%m-%dT%H:%M:%fZ', check_in_time)
  WHERE check_in_time GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][ T][0-9][0-9]:[0-9][0-9]*[+-][0-9][0-9]:[0-9][0-9]'
    AND strftime('%Y-%m-%dT%H:%M:%fZ', check_in_time) IS NOT NULL;
UPDATE attendance_records SET check_in_time = strftime('%Y-%m-%dT%H:%M:%fZ', check_in_time)
  WHERE (check_in_time GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][ T][0-9][0-9]:[0-9][0-9]' OR check_in_time GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][ T][0-9][0-9]:[0-9][0-9]:[0-9][0-9]' OR check_in_time GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][ T][0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9]*[0-9]')
    AND strftime('%Y-%m-%dT%H:%M:%fZ', check_in_time) IS NOT NULL;
UPDATE certificates SET issued_at = strftime('%Y-%m-%dT%H:%M:%fZ', issued_at)
  WHERE issued_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][ T][0-9][0-9]:[0-9][0-9]*[+-][0-9][0-9]:[0-9][0-9]'
    AND strftime('%Y-%m-%dT%H:%M:%fZ', issued_at) IS NOT NULL;
UPDATE certificates SET issued_at = strftime('%Y-%m-%dT%H:%M:%fZ', issued_at)
  WHERE (issued_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][ T][0-9][0-9]:[0-9][0-9]' OR issued_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][ T][0-9][0-9]:[0-9][0-9]:[0-9][0-9]' OR issued_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][ T][0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9]*[0-9]')
    AND strftime('%Y-%m-%dT%H:%M:%fZ', issued_at) IS NOT NULL;
UPDATE certificates SET revoked_at = strftime('%Y-%m-%dT%H:%M:%fZ', revoked_at)
  WHERE revoked_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][ T][0-9][0-9]:[0-9][0-9]*[+-][0-9][0-9]:[0-9][0-9]'
    AND strftime('%Y-%m-%dT%H:%M:%fZ', revoked_at) IS NOT NULL;
UPDATE certificates SET revoked_at = strftime('%Y-%m-%dT%H:%M:%fZ', revoked_at)
  WHERE (revoked_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][ T][0-9][0-9]:[0-9][0-9]' OR revoked_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][ T][0-9][0-9]:[0-9][0-9]:[0-9][0-9]' OR revoked_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][ T][0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9]*[0-9]')
    AND strftime('%Y-%m-%dT%H:%M:%fZ', revoked_at) IS NOT NULL;
UPDATE announcements SET created_at = strftime('%Y-%m-%dT%H:%M:%fZ', created_at)
  WHERE created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][ T][0-9][0-9]:[0-9][0-9]*[+-][0-9][0-9]:[0-9][0-9]'
    AND strftime('%Y-%m-%dT%H:%M:%fZ', created_at) IS NOT NULL;
UPDATE announcements SET created_at = strftime('%Y-%m-%dT%H:%M:%fZ', created_at)
  WHERE (created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][ T][0-9][0-9]:[0-9][0-9]' OR created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][ T][0-9][0-9]:[0-9][0-9]:[0-9][0-9]' OR created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][ T][0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9]*[0-9]')
    AND strftime('%Y-%m-%dT%H:%M:%fZ', created_at) IS NOT NULL;
UPDATE notifications SET created_at = strftime('%Y-%m-%dT%H:%M:%fZ', created_at)
  WHERE created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][ T][0-9][0-9]:[0-9][0-9]*[+-][0-9][0-9]:[0-9][0-9]'
    AND strftime('%Y-%m-%dT%H:%M:%fZ', created_at) IS NOT NULL;
UPDATE notifications SET created_at = strftime('%Y-%m-%dT%H:%M:%fZ', created_at)
  WHERE (created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][ T][0-9][0-9]:[0-9][0-9]' OR created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][ T][0-9][0-9]:[0-9][0-9]:[0-9][0-9]' OR created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][ T][0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9]*[0-9]')
    AND strftime('%Y-%m-%dT%H:%M:%fZ', created_at) IS NOT NULL;
UPDATE feedback SET submitted_at = strftime('%Y-%m-%dT%H:%M:%fZ', submitted_at)
  WHERE submitted_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][ T][0-9][0-9]:[0-9][0-9]*[+-][0-9][0-9]:[0-9][0-9]'
    AND strftime('%Y-%m-%dT%H:%M:%fZ', submitted_at) IS NOT NULL;
UPDATE feedback SET submitted_at = strftime('%Y-%m-%dT%H:%M:%fZ', submitted_at)
  WHERE (submitted_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][ T][0-9][0-9]:[0-9][0-9]' OR submitted_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][ T][0-9][0-9]:[0-9][0-9]:[0-9][0-9]' OR submitted_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][ T][0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9]*[0-9]')
    AND strftime('%Y-%m-%dT%H:%M:%fZ', submitted_at) IS NOT NULL;
UPDATE audit_logs SET timestamp = strftime('%Y-%m-%dT%H:%M:%fZ', timestamp)
  WHERE timestamp GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][ T][0-9][0-9]:[0-9][0-9]*[+-][0-9][0-9]:[0-9][0-9]'
    AND strftime('%Y-%m-%dT%H:%M:%fZ', timestamp) IS NOT NULL;
UPDATE audit_logs SET timestamp = strftime('%Y-%m-%dT%H:%M:%fZ', timestamp)
  WHERE (timestamp GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][ T][0-9][0-9]:[0-9][0-9]' OR timestamp GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][ T][0-9][0-9]:[0-9][0-9]:[0-9][0-9]' OR timestamp GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][ T][0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9]*[0-9]')
    AND strftime('%Y-%m-%dT%H:%M:%fZ', timestamp) IS NOT NULL;
