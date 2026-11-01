-- 006_cert_signing: compact JWS (EdDSA / Ed25519) over the certificate credential payload. (PostgreSQL port)
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS jws TEXT;
