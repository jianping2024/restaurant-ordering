-- Staff buffet config freshness: bump when buffet / slots / rules / calendar / friday policy change.
-- Clients compare knownVersion + current slot before re-fetching openable ids (same pattern as menu_catalog_version).

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS buffet_config_version integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.restaurants.buffet_config_version IS
  'Monotonic counter bumped when staff buffet config changes (buffets, slots, price rules, calendar, friday policy). Staff clients compare before re-fetching openable buffet ids.';

-- Sole「当前时段」id: same nearest-slot ladder as buffet_openable_ids (Lisbon wall clock).
CREATE OR REPLACE FUNCTION public.buffet_current_slot_id(
  p_restaurant_id uuid,
  p_at timestamptz DEFAULT now()
)
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH local AS (
    SELECT
      (p_at AT TIME ZONE 'Europe/Lisbon')::time AS t,
      extract(dow FROM (p_at AT TIME ZONE 'Europe/Lisbon'))::int AS dow
  )
  SELECT ts.id
  FROM public.buffet_time_slots ts, local
  WHERE ts.restaurant_id = p_restaurant_id
    AND local.dow = ANY (ts.weekdays)
  ORDER BY public.buffet_slot_distance_seconds(ts.start_time, ts.end_time, local.t) ASC,
    ts.sort_order ASC,
    ts.name ASC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.buffet_current_slot_id(uuid, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.buffet_current_slot_id(uuid, timestamptz) TO authenticated, service_role;
