-- 003_cert_revocation: revocation metadata for certificates. (PostgreSQL port)
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS revoked_reason TEXT;
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS revoked_at TEXT;
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS revoked_by TEXT REFERENCES users(id);
