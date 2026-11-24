-- Multi-store batch 3A: revenue raw materials for many stores in one round-trip.
-- Same per-store body as dashboard_overview_revenue_bundle (no second SQL 口径):
-- returns { "<restaurant_id>": <dashboard_overview_revenue_bundle payload>, ... }.
-- Callers pass only ids from the sole auth entry (service_role only).

CREATE OR REPLACE FUNCTION public.dashboard_overview_revenue_bundles(
  p_restaurant_ids uuid[],
  p_start_utc timestamptz,
  p_end_exclusive_utc timestamptz,
  p_max_sessions integer DEFAULT 2000
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT coalesce(
    jsonb_object_agg(
      rid::text,
      public.dashboard_overview_revenue_bundle(rid, p_start_utc, p_end_exclusive_utc, p_max_sessions)
    ),
    '{}'::jsonb
  )
    FROM (SELECT DISTINCT unnest(coalesce(p_restaurant_ids, '{}'::uuid[])) AS rid) ids;
$$;

REVOKE ALL ON FUNCTION public.dashboard_overview_revenue_bundles(uuid[], timestamptz, timestamptz, integer)
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_overview_revenue_bundles(uuid[], timestamptz, timestamptz, integer)
  TO service_role;
