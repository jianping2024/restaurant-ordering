-- Restaurant-scoped notice shown on the customer ordering menu (owner + frontdesk editable).

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS guest_ordering_notice jsonb NOT NULL DEFAULT jsonb_build_object(
    'enabled', false,
    'title', jsonb_build_object('pt', '', 'en', '', 'zh', ''),
    'body', jsonb_build_object('pt', '', 'en', '', 'zh', ''),
    'updated_at', null
  );

COMMENT ON COLUMN public.restaurants.guest_ordering_notice IS
  'Customer menu notice: { enabled, title{pt,en,zh}, body{pt,en,zh}, updated_at }. Plain text only.';

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
  buffet_service_mode,
  guest_ordering_notice
FROM public.restaurants;

COMMENT ON VIEW public.restaurants_public IS
  'Public restaurant fields for ordering surfaces (no passwords); includes buffet_service_mode and guest_ordering_notice.';
