-- Per-restaurant offline grace for on-prem lease mint (default 7 days).
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS license_offline_grace_days integer NOT NULL DEFAULT 7;

ALTER TABLE public.restaurants
  DROP CONSTRAINT IF EXISTS restaurants_license_offline_grace_days_range;

ALTER TABLE public.restaurants
  ADD CONSTRAINT restaurants_license_offline_grace_days_range
  CHECK (license_offline_grace_days >= 1 AND license_offline_grace_days <= 365);

COMMENT ON COLUMN public.restaurants.license_offline_grace_days IS
  'On-prem: days without platform check-in before lease expires (minted into lease_until). Cloud unused.';
