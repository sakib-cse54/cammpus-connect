-- 003_cert_revocation: revocation metadata for certificates.
ALTER TABLE certificates ADD COLUMN revoked_reason TEXT;
ALTER TABLE certificates ADD COLUMN revoked_at TEXT;
ALTER TABLE certificates ADD COLUMN revoked_by TEXT REFERENCES users(id);
