-- CampusConnect Relational Schema (PostgreSQL 16)
-- Conforms to IEEE Std 830-1998 / ISO/IEC/IEEE 29148 Standard

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'STUDENT',
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    token_version INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Student Profiles Table
CREATE TABLE IF NOT EXISTS student_profiles (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    student_id_number VARCHAR(64) NOT NULL UNIQUE,
    full_name VARCHAR(128) NOT NULL,
    department VARCHAR(128) NOT NULL,
    batch_year INTEGER NOT NULL,
    phone_number VARCHAR(32),
    avatar_url VARCHAR(512)
);

-- 3. Event Categories
CREATE TABLE IF NOT EXISTS event_categories (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(64) NOT NULL UNIQUE,
    description TEXT
);

-- 4. Clubs Table
CREATE TABLE IF NOT EXISTS clubs (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(128) NOT NULL UNIQUE,
    slug VARCHAR(128) NOT NULL UNIQUE,
    description TEXT NOT NULL,
    category VARCHAR(64) NOT NULL,
    logo_url VARCHAR(512),
    faculty_advisor_id VARCHAR(36) NOT NULL REFERENCES users(id),
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Club Memberships Table
CREATE TABLE IF NOT EXISTS club_memberships (
    id VARCHAR(36) PRIMARY KEY,
    club_id VARCHAR(36) NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    club_role VARCHAR(32) NOT NULL DEFAULT 'MEMBER',
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    joined_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT uq_club_user UNIQUE (club_id, user_id)
);

-- 6. Events Table
CREATE TABLE IF NOT EXISTS events (
    id VARCHAR(36) PRIMARY KEY,
    club_id VARCHAR(36) NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    venue VARCHAR(255) NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    capacity INTEGER NOT NULL CHECK (capacity > 0),
    registered_count INTEGER NOT NULL DEFAULT 0,
    registration_deadline TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    advisor_remarks TEXT,
    cancellation_reason TEXT,
    requires_feedback_for_cert BOOLEAN NOT NULL DEFAULT TRUE,
    created_by VARCHAR(36) NOT NULL REFERENCES users(id)
);

-- 7. Registrations Table
CREATE TABLE IF NOT EXISTS registrations (
    id VARCHAR(36) PRIMARY KEY,
    event_id VARCHAR(36) NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ticket_code VARCHAR(64) NOT NULL UNIQUE,
    status VARCHAR(32) NOT NULL DEFAULT 'CONFIRMED',
    waitlist_position INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_event_user UNIQUE (event_id, user_id)
);

-- 8. Attendance Records Table
CREATE TABLE IF NOT EXISTS attendance_records (
    id VARCHAR(36) PRIMARY KEY,
    event_id VARCHAR(36) NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    registration_id VARCHAR(36) NOT NULL UNIQUE REFERENCES registrations(id) ON DELETE CASCADE,
    check_in_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    method VARCHAR(32) NOT NULL,
    recorded_by VARCHAR(36) NOT NULL REFERENCES users(id)
);

-- 9. Certificates Table
CREATE TABLE IF NOT EXISTS certificates (
    id VARCHAR(36) PRIMARY KEY,
    serial_number VARCHAR(64) NOT NULL UNIQUE,
    event_id VARCHAR(36) NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pdf_url VARCHAR(512) NOT NULL,
    sha256_hash VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'VALID',
    issued_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    revoked_reason TEXT,
    revoked_at TIMESTAMP WITH TIME ZONE,
    revoked_by VARCHAR(36) REFERENCES users(id),
    CONSTRAINT uq_cert_event_user UNIQUE (event_id, user_id)
);

-- 10. Announcements Table
CREATE TABLE IF NOT EXISTS announcements (
    id VARCHAR(36) PRIMARY KEY,
    club_id VARCHAR(36) NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    author_id VARCHAR(36) NOT NULL REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    link_url VARCHAR(512),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 12. Feedback Table
CREATE TABLE IF NOT EXISTS feedback (
    id VARCHAR(36) PRIMARY KEY,
    event_id VARCHAR(36) NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comments TEXT,
    is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_feedback_event_user UNIQUE (event_id, user_id)
);

-- 13. Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(36) PRIMARY KEY,
    actor_id VARCHAR(36),
    action VARCHAR(128) NOT NULL,
    entity_type VARCHAR(64) NOT NULL,
    entity_id VARCHAR(64),
    details TEXT,
    ip_address VARCHAR(64),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for Query Performance
CREATE INDEX IF NOT EXISTS idx_events_club_id ON events(club_id);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_registrations_event_id ON registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_registrations_user_id ON registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_event_user ON attendance_records(event_id, user_id);
CREATE INDEX IF NOT EXISTS idx_certificates_serial ON certificates(serial_number);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_event ON attendance_records(event_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON club_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_event ON feedback(event_id);

-- 004: academic calendar, venues and events.venue_id (mirrors migrations/004_calendar_venues.sql)
CREATE TABLE IF NOT EXISTS semesters (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS calendar_blackouts (
    id VARCHAR(64) PRIMARY KEY,
    semester_id VARCHAR(64) REFERENCES semesters(id),
    kind VARCHAR(20) NOT NULL CHECK (kind IN ('FINAL_EXAM', 'MIDTERM', 'HOLIDAY', 'NATIONAL_DAY')),
    title_en VARCHAR(200) NOT NULL,
    title_bn VARCHAR(200),
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    tentative BOOLEAN NOT NULL DEFAULT FALSE,
    severity VARCHAR(10) NOT NULL CHECK (severity IN ('BLOCK', 'WARN')),
    created_by VARCHAR(36) REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_blackouts_range ON calendar_blackouts(starts_at, ends_at);
CREATE TABLE IF NOT EXISTS venues (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(200) NOT NULL UNIQUE,
    building VARCHAR(200),
    capacity INTEGER NOT NULL CHECK (capacity > 0),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    radius_m INTEGER,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);
ALTER TABLE events ADD COLUMN IF NOT EXISTS venue_id VARCHAR(64) REFERENCES venues(id);
CREATE INDEX IF NOT EXISTS idx_events_venue_time ON events(venue_id, start_time, end_time);

-- 005: check-in v2 (mirrors migrations/005_checkin_v2.sql)
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS flags TEXT;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS distance_m DOUBLE PRECISION;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS device_id VARCHAR(64);
CREATE INDEX IF NOT EXISTS idx_attendance_event_device ON attendance_records(event_id, device_id);

-- 006: signed certificates (mirrors migrations/006_cert_signing.sql)
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS jws TEXT;

-- 007: OBE outcomes, BAETE PO1 to PO12 (mirrors migrations/007_outcomes.sql; seed rows are inserted there)
CREATE TABLE IF NOT EXISTS program_outcomes (
  id TEXT PRIMARY KEY,
  framework TEXT NOT NULL DEFAULT 'BAETE',
  code TEXT NOT NULL,
  title_en TEXT NOT NULL,
  title_bn TEXT NOT NULL,
  description TEXT NOT NULL,
  UNIQUE (framework, code)
);
CREATE TABLE IF NOT EXISTS event_outcomes (
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  po_code TEXT NOT NULL,
  weight INTEGER NOT NULL CHECK (weight BETWEEN 1 AND 3),
  tagged_by TEXT REFERENCES users(id),
  tagged_at TEXT NOT NULL,
  PRIMARY KEY (event_id, po_code)
);
CREATE TABLE IF NOT EXISTS role_outcomes (
  club_role TEXT NOT NULL,
  po_code TEXT NOT NULL,
  weight INTEGER NOT NULL CHECK (weight BETWEEN 1 AND 3),
  PRIMARY KEY (club_role, po_code)
);
CREATE TABLE IF NOT EXISTS reflections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (user_id, event_id)
);
CREATE TABLE IF NOT EXISTS transcripts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  issued_at TEXT NOT NULL,
  summary_json TEXT NOT NULL,
  jws TEXT
);
CREATE INDEX IF NOT EXISTS idx_event_outcomes_po ON event_outcomes(po_code);
CREATE INDEX IF NOT EXISTS idx_reflections_user ON reflections(user_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_user ON transcripts(user_id);
