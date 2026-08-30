-- Fiscal product signing key installations (Ops activate → Agent pulls wrapped C).
-- Authority: farvoo-fatura docs/fiscal-ops-signing-key.zh.md

CREATE TABLE IF NOT EXISTS public.fiscal_signing_installations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants (id) ON DELETE CASCADE,
  device_id uuid NOT NULL,
  device_public_key text NOT NULL,
  signing_key_version integer NOT NULL DEFAULT 1,
  product_public_key_pem text,
  wrapped_private_key text,
  status text NOT NULL CHECK (status IN ('registered', 'active', 'revoked')),
  activated_at timestamptz,
  revoked_at timestamptz,
  activated_by uuid,
  revoked_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS fiscal_signing_installations_one_active_per_restaurant
  ON public.fiscal_signing_installations (restaurant_id)
  WHERE status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS fiscal_signing_installations_one_open_per_device
  ON public.fiscal_signing_installations (restaurant_id, device_id)
  WHERE status IN ('registered', 'active');

CREATE INDEX IF NOT EXISTS fiscal_signing_installations_restaurant_status
  ON public.fiscal_signing_installations (restaurant_id, status);

ALTER TABLE public.fiscal_signing_installations ENABLE ROW LEVEL SECURITY;
-- No anon/auth policies: service_role / Ops admin client only.
