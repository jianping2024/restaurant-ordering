-- Station kitchen workflow: per-station flag, kitchen screens (max 2 stations), serve-to-table flag storage via feature_flags.

ALTER TABLE public.print_stations
  ADD COLUMN IF NOT EXISTS kitchen_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.print_stations.kitchen_enabled IS
  'When true: station uses kitchen screen workflow (no auto station_ticket on order; prep prints).';

CREATE TABLE IF NOT EXISTS public.kitchen_screens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.kitchen_screen_stations (
  screen_id uuid NOT NULL REFERENCES public.kitchen_screens(id) ON DELETE CASCADE,
  print_station_id uuid NOT NULL REFERENCES public.print_stations(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY (screen_id, print_station_id)
);

CREATE INDEX IF NOT EXISTS idx_kitchen_screens_restaurant
  ON public.kitchen_screens (restaurant_id, sort_order, created_at);

CREATE INDEX IF NOT EXISTS idx_kitchen_screen_stations_station
  ON public.kitchen_screen_stations (print_station_id);

ALTER TABLE public.kitchen_screens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kitchen_screen_stations ENABLE ROW LEVEL SECURITY;

-- Owner / frontdesk manage; kitchen staff read (via service role APIs primarily).
DROP POLICY IF EXISTS kitchen_screens_owner_all ON public.kitchen_screens;
CREATE POLICY kitchen_screens_owner_all ON public.kitchen_screens
  AS PERMISSIVE FOR ALL TO authenticated
  USING (
    restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS kitchen_screens_staff_select ON public.kitchen_screens;
CREATE POLICY kitchen_screens_staff_select ON public.kitchen_screens
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.is_active_restaurant_staff(restaurant_id));

DROP POLICY IF EXISTS kitchen_screen_stations_owner_all ON public.kitchen_screen_stations;
CREATE POLICY kitchen_screen_stations_owner_all ON public.kitchen_screen_stations
  AS PERMISSIVE FOR ALL TO authenticated
  USING (
    screen_id IN (
      SELECT ks.id FROM public.kitchen_screens ks
      WHERE ks.restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid())
    )
  )
  WITH CHECK (
    screen_id IN (
      SELECT ks.id FROM public.kitchen_screens ks
      WHERE ks.restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS kitchen_screen_stations_staff_select ON public.kitchen_screen_stations;
CREATE POLICY kitchen_screen_stations_staff_select ON public.kitchen_screen_stations
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    screen_id IN (
      SELECT ks.id FROM public.kitchen_screens ks
      WHERE public.is_active_restaurant_staff(ks.restaurant_id)
    )
  );

-- Max 2 stations per screen (enforce via trigger).
CREATE OR REPLACE FUNCTION public.enforce_kitchen_screen_station_limit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  cnt integer;
BEGIN
  SELECT count(*) INTO cnt
  FROM public.kitchen_screen_stations
  WHERE screen_id = NEW.screen_id;
  IF TG_OP = 'INSERT' AND cnt >= 2 THEN
    RAISE EXCEPTION 'kitchen_screen_station_limit'
      USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.screen_id IS DISTINCT FROM OLD.screen_id THEN
    SELECT count(*) INTO cnt
    FROM public.kitchen_screen_stations
    WHERE screen_id = NEW.screen_id;
    IF cnt >= 2 THEN
      RAISE EXCEPTION 'kitchen_screen_station_limit'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kitchen_screen_station_limit ON public.kitchen_screen_stations;
CREATE TRIGGER trg_kitchen_screen_station_limit
  BEFORE INSERT OR UPDATE ON public.kitchen_screen_stations
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_kitchen_screen_station_limit();
