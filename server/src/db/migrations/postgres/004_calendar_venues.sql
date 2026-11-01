-- 004: UITS academic calendar (semesters + blackouts), venues, events.venue_id. (PostgreSQL port)
-- Instants are ISO 8601 UTC strings bound from app code; semester dates are
-- plain YYYY-MM-DD calendar days in Asia/Dhaka.
CREATE TABLE IF NOT EXISTS semesters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS calendar_blackouts (
  id TEXT PRIMARY KEY,
  semester_id TEXT REFERENCES semesters(id),
  kind TEXT NOT NULL CHECK (kind IN ('FINAL_EXAM', 'MIDTERM', 'HOLIDAY', 'NATIONAL_DAY')),
  title_en TEXT NOT NULL,
  title_bn TEXT,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  tentative INTEGER NOT NULL DEFAULT 0,
  severity TEXT NOT NULL CHECK (severity IN ('BLOCK', 'WARN')),
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_blackouts_range ON calendar_blackouts (starts_at, ends_at);

CREATE TABLE IF NOT EXISTS venues (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  building TEXT,
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  radius_m INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

ALTER TABLE events ADD COLUMN IF NOT EXISTS venue_id TEXT REFERENCES venues(id);
CREATE INDEX IF NOT EXISTS idx_events_venue_time ON events (venue_id, start_time, end_time);
