-- Wipe all tenant data on staging before cloud restore.
-- Preserves schema/migrations; only clears rows in public, auth, storage.
-- Run with session_replication_role = replica to bypass FK/trigger checks.

SET session_replication_role = replica;

DELETE FROM auth.refresh_tokens;
DELETE FROM auth.sessions;
DELETE FROM auth.mfa_challenges;
DELETE FROM auth.mfa_factors;
DELETE FROM auth.one_time_tokens;
DELETE FROM auth.identities;
DELETE FROM auth.users;

DELETE FROM storage.objects;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('TRUNCATE TABLE public.%I CASCADE', r.tablename);
  END LOOP;
END $$;

RESET session_replication_role;
