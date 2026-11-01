-- 008_token_version (PostgreSQL): users.token_version for refresh-token revocation.
-- The SQLite migration of the same number also rewrites legacy timestamp formats
-- (strftime/GLOB clean-up). A new PostgreSQL database never held legacy values, so
-- only the schema change applies here.

ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;
