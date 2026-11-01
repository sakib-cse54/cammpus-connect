-- 009_row_level_security (PostgreSQL): lock every app table away from Supabase's public API.
-- Supabase exposes tables in the public schema over a REST API using the anon and
-- authenticated roles. These tables hold password hashes and personal data, and the app
-- reads them only through its own server connection (a role that bypasses RLS).
-- RLS enabled with no policies means anon and authenticated can read and write nothing.
-- IMPORTANT: add the same statement to any future migration that creates a table.

DO $$
DECLARE t RECORD;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = current_schema() LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t.tablename);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE ALL ON TABLE %I FROM anon', t.tablename);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE format('REVOKE ALL ON TABLE %I FROM authenticated', t.tablename);
    END IF;
  END LOOP;
END
$$;
