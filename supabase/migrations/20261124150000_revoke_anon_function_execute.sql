-- Tighten EXECUTE on public functions: anon (and server-only from authenticated).
--
-- Why: Postgres grants EXECUTE to PUBLIC on every new function, and Supabase's default
-- privileges also grant anon/authenticated. Earlier migrations that only did
-- `REVOKE … FROM PUBLIC` left the explicit anon grant in place, so the anon key could call
-- SECURITY DEFINER RPCs (e.g. seed_default_menu_note_presets wrote rows for any restaurant)
-- and server-only read RPCs (e.g. dashboard_overview_revenue_bundle).
--
-- Callers (audited 2026-11-24):
--   * Every app RPC runs through the server admin client (service_role); guest QR surfaces
--     (createGuestClient) call no RPC. Only browser RPC: BuffetPricePreview →
--     resolve_buffet_prices (authenticated staff). WaiterTableDetail transfer/merge RPC is
--     demo-only (fake restaurant id); the live path is the server action route.
--   * RLS policies call helper functions as the querying role — those keep EXECUTE for the
--     roles whose policies reference them (detected from pg_policies below).
--
-- Rule after this migration:
--   anon          → only functions referenced by anon/public RLS policies.
--   authenticated → functions referenced by authenticated/public RLS policies, plus the
--                   resolve_buffet_prices chain used by the staff browser.
--   service_role  → everything (granted explicitly so dropping PUBLIC cannot break it).
-- New functions in public no longer get Supabase's explicit anon default grant, so the usual
-- `REVOKE EXECUTE … FROM PUBLIC` in a new migration is enough to close anon. (The built-in PUBLIC
-- default is global and cannot be revoked per schema — keep writing that REVOKE.)

DO $$
DECLARE
  r record;
  v_sig text;
  v_anon_policy boolean;
  v_auth_policy boolean;
  v_auth_browser constant text[] := ARRAY[
    'resolve_buffet_prices',
    'buffet_calendar_kind',
    'buffet_slot_distance_seconds'
  ];
BEGIN
  FOR r IN
    SELECT p.oid, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind IN ('f', 'p')
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e'
      )
  LOOP
    v_sig := r.oid::regprocedure::text;

    SELECT
      bool_or(pol.roles && ARRAY['anon', 'public']::name[]),
      bool_or(pol.roles && ARRAY['authenticated', 'public']::name[])
    INTO v_anon_policy, v_auth_policy
    FROM pg_policies pol
    WHERE (coalesce(pol.qual, '') || ' ' || coalesce(pol.with_check, ''))
      ~ ('\m' || r.proname || '\M');

    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', v_sig);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', v_sig);

    IF coalesce(v_anon_policy, false) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon', v_sig);
    END IF;

    IF coalesce(v_auth_policy, false) OR r.proname = ANY (v_auth_browser) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', v_sig);
    ELSE
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', v_sig);
    END IF;
  END LOOP;
END
$$;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon;
