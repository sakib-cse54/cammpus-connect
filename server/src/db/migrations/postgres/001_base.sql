-- 001_base (PostgreSQL): CampusConnect base schema, ported from the SQLite migration of the same name.
-- Timestamps stay ISO 8601 UTC TEXT (not timestamptz) and flags stay INTEGER 0/1 so the
-- application code and its string range comparisons behave identically on both engines.
-- cc_now_iso() is only a fallback default: app code binds every timestamp via nowIso().

CREATE OR REPLACE FUNCTION cc_now_iso() RETURNS TEXT
  LANGUAGE sql STABLE
  AS $$ SELECT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') $$;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'STUDENT',
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TEXT DEFAULT cc_now_iso(),
  updated_at TEXT DEFAULT cc_now_iso()
);

CREATE TABLE IF NOT EXISTS student_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  student_id_number TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  department TEXT NOT NULL,
  batch_year INTEGER NOT NULL,
  phone_number TEXT,
  avatar_url TEXT
);

CREATE TABLE IF NOT EXISTS event_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT
);

CREATE TABLE IF NOT EXISTS clubs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  logo_url TEXT,
  faculty_advisor_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TEXT DEFAULT cc_now_iso()
);

CREATE TABLE IF NOT EXISTS club_memberships (
  id TEXT PRIMARY KEY,
  club_id TEXT NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  club_role TEXT NOT NULL DEFAULT 'MEMBER',
  status TEXT NOT NULL DEFAULT 'PENDING',
  joined_at TEXT,
  UNIQUE (club_id, user_id)
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  club_id TEXT NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  venue TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  registered_count INTEGER NOT NULL DEFAULT 0,
  registration_deadline TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  advisor_remarks TEXT,
  requires_feedback_for_cert INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS registrations (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ticket_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'CONFIRMED',
  waitlist_position INTEGER,
  created_at TEXT DEFAULT cc_now_iso(),
  UNIQUE (event_id, user_id)
);

CREATE TABLE IF NOT EXISTS attendance_records (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  registration_id TEXT NOT NULL UNIQUE REFERENCES registrations(id) ON DELETE CASCADE,
  check_in_time TEXT DEFAULT cc_now_iso(),
  method TEXT NOT NULL,
  recorded_by TEXT NOT NULL REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS certificates (
  id TEXT PRIMARY KEY,
  serial_number TEXT NOT NULL UNIQUE,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pdf_url TEXT NOT NULL,
  sha256_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'VALID',
  issued_at TEXT DEFAULT cc_now_iso(),
  UNIQUE (event_id, user_id)
);

CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY,
  club_id TEXT NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT DEFAULT cc_now_iso()
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link_url TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT cc_now_iso()
);

CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comments TEXT,
  is_anonymous INTEGER NOT NULL DEFAULT 0,
  submitted_at TEXT DEFAULT cc_now_iso(),
  UNIQUE (event_id, user_id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details TEXT,
  ip_address TEXT,
  timestamp TEXT DEFAULT cc_now_iso()
);

CREATE INDEX IF NOT EXISTS idx_events_club ON events(club_id);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_reg_event ON registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_reg_user ON registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_cert_serial ON certificates(serial_number);
