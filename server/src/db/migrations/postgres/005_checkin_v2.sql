-- 005_checkin_v2: anti-proxy check-in v2 (geofence distance, review flags, device binding lite). (PostgreSQL port)
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS flags TEXT;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS distance_m DOUBLE PRECISION;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS device_id TEXT;
CREATE INDEX IF NOT EXISTS idx_attendance_event_device ON attendance_records(event_id, device_id);
