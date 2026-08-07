-- Raise kitchen screen station cap from 2 to 4 (single product limit).
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
  IF TG_OP = 'INSERT' AND cnt >= 4 THEN
    RAISE EXCEPTION 'kitchen_screen_station_limit'
      USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.screen_id IS DISTINCT FROM OLD.screen_id THEN
    SELECT count(*) INTO cnt
    FROM public.kitchen_screen_stations
    WHERE screen_id = NEW.screen_id;
    IF cnt >= 4 THEN
      RAISE EXCEPTION 'kitchen_screen_station_limit'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
