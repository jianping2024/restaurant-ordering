-- Expose buffet_service_mode on restaurants_public so floor staff (and public catalog)
-- can read the same sushi/classic switch used by customer menu SSR.

CREATE OR REPLACE VIEW public.restaurants_public
WITH (security_invoker = false)
AS
SELECT
  id,
  name,
  slug,
  logo_url,
  address,
  phone,
  plan,
  geo_latitude,
  geo_longitude,
  print_locale,
  created_at,
  order_radius_meters,
  buffet_service_mode
FROM public.restaurants;

COMMENT ON VIEW public.restaurants_public IS
  'Public restaurant fields for ordering surfaces (no passwords); includes buffet_service_mode.';
