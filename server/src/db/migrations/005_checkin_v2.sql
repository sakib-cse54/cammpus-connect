-- 005_checkin_v2: anti-proxy check-in v2 (geofence distance, review flags, device binding lite).
ALTER TABLE attendance_records ADD COLUMN flags TEXT;
ALTER TABLE attendance_records ADD COLUMN distance_m REAL;
ALTER TABLE attendance_records ADD COLUMN device_id TEXT;
CREATE INDEX IF NOT EXISTS idx_attendance_event_device ON attendance_records(event_id, device_id);
