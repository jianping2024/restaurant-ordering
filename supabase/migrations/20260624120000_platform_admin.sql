-- Mesa platform ops: admin accounts + audit log (service-role access from @mesa/ops only)

CREATE TABLE public.platform_admin_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('support', 'admin')),
  display_name text NOT NULL,
  disabled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.platform_admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  restaurant_id uuid REFERENCES public.restaurants (id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_platform_admin_audit_log_created
  ON public.platform_admin_audit_log (created_at DESC);

CREATE INDEX idx_platform_admin_audit_log_restaurant
  ON public.platform_admin_audit_log (restaurant_id)
  WHERE restaurant_id IS NOT NULL;

ALTER TABLE public.platform_admin_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_admin_audit_log ENABLE ROW LEVEL SECURITY;

-- No policies: tenant-facing roles must not read/write; @mesa/ops uses service role after session check.
