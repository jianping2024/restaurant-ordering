-- Guest storefront profile: cover, weekly hours, trilingual intro.
-- Separate from print_agent_config.schedule (agent pull windows).

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS cover_url text,
  ADD COLUMN IF NOT EXISTS business_hours jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS storefront_intro jsonb NOT NULL DEFAULT jsonb_build_object(
    'pt', '',
    'en', '',
    'zh', ''
  );

COMMENT ON COLUMN public.restaurants.cover_url IS
  'Guest menu storefront cover image public URL (optional).';
COMMENT ON COLUMN public.restaurants.business_hours IS
  'Guest-facing weekly hours: { timezone?: string, week?: { "1"|"2"|…|"7": [{open,close},…] } }. Europe/Lisbon default. Not print-agent schedule.';
COMMENT ON COLUMN public.restaurants.storefront_intro IS
  'Guest storefront intro: { pt, en, zh }. Plain text; empty langs omit.';

-- CREATE OR REPLACE cannot insert columns mid-list; drop + recreate.
DROP VIEW IF EXISTS public.restaurants_public;

CREATE VIEW public.restaurants_public
WITH (security_invoker = false)
AS
SELECT
  id,
  name,
  slug,
  logo_url,
  cover_url,
  address,
  phone,
  plan,
  geo_latitude,
  geo_longitude,
  print_locale,
  created_at,
  order_radius_meters,
  buffet_service_mode,
  guest_ordering_notice,
  business_hours,
  storefront_intro
FROM public.restaurants;

COMMENT ON VIEW public.restaurants_public IS
  'Public restaurant fields for ordering surfaces (no passwords); includes storefront profile.';

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.restaurants_public TO anon, authenticated, service_role;
