-- On-prem control plane: deployment mode, license clock, installations.
-- Runtime gate remains restaurants.suspended_at only (see ADR-004).

-- Absorb unused orphan service_valid_until into the single license clock column.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'restaurants' AND column_name = 'service_valid_until'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'restaurants' AND column_name = 'license_valid_until'
  ) THEN
    ALTER TABLE public.restaurants RENAME COLUMN service_valid_until TO license_valid_until;
  END IF;
END $$;

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS deployment_mode text NOT NULL DEFAULT 'cloud',
  ADD COLUMN IF NOT EXISTS license_valid_until timestamptz,
  ADD COLUMN IF NOT EXISTS owner_email text,
  ADD COLUMN IF NOT EXISTS license_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS license_lease_until timestamptz,
  ADD COLUMN IF NOT EXISTS license_lease_token text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'restaurants_deployment_mode_check'
  ) THEN
    ALTER TABLE public.restaurants
      ADD CONSTRAINT restaurants_deployment_mode_check
      CHECK (deployment_mode IN ('cloud', 'on_prem'));
  END IF;
END $$;

-- Cloud rows keep a required owner; on_prem registry may be pending claim.
ALTER TABLE public.restaurants
  ALTER COLUMN owner_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'restaurants_cloud_owner_required'
  ) THEN
    ALTER TABLE public.restaurants
      ADD CONSTRAINT restaurants_cloud_owner_required
      CHECK (
        deployment_mode <> 'cloud'
        OR owner_id IS NOT NULL
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_restaurants_deployment_mode
  ON public.restaurants (deployment_mode);

CREATE INDEX IF NOT EXISTS idx_restaurants_license_valid_until
  ON public.restaurants (license_valid_until)
  WHERE license_valid_until IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.restaurant_installations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants (id) ON DELETE CASCADE,
  install_code_hash text NOT NULL,
  checkin_secret_hash text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'claimed', 'revoked')),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  claimed_at timestamptz,
  revoked_at timestamptz,
  last_checkin_at timestamptz,
  created_by uuid REFERENCES auth.users (id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_restaurant_installations_code_hash
  ON public.restaurant_installations (install_code_hash);

CREATE INDEX IF NOT EXISTS idx_restaurant_installations_restaurant
  ON public.restaurant_installations (restaurant_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_restaurant_installations_one_pending
  ON public.restaurant_installations (restaurant_id)
  WHERE status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS idx_restaurant_installations_one_claimed
  ON public.restaurant_installations (restaurant_id)
  WHERE status = 'claimed';

ALTER TABLE public.restaurant_installations ENABLE ROW LEVEL SECURITY;

COMMENT ON COLUMN public.restaurants.deployment_mode IS
  'cloud = SaaS tenant row; on_prem = platform control-plane registry (business authority is local after claim)';
COMMENT ON COLUMN public.restaurants.license_valid_until IS
  'Platform license end; null = no expiry. Materialize into suspended_at when past.';
COMMENT ON COLUMN public.restaurants.license_checked_at IS
  'Last successful platform check-in server_time (local lease clock). cloud unused.';
COMMENT ON COLUMN public.restaurants.license_lease_until IS
  'Offline grace end from last signed lease. cloud unused.';
COMMENT ON COLUMN public.restaurants.license_lease_token IS
  'HMAC-signed lease JWT from platform check-in. cloud unused.';
COMMENT ON TABLE public.restaurant_installations IS
  'On-prem install codes + check-in identity; one pending and one claimed per restaurant.';
