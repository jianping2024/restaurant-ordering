-- Restaurant-configurable staff roles + permission sets (Capability RBAC).
-- Permissions live on restaurant_roles.permissions (jsonb array) — one representation.
-- Staff bind via role_id; disabled role blocks login. Delete only when unoccupied.

CREATE TABLE public.restaurant_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants (id) ON DELETE CASCADE,
  name text NOT NULL,
  preset_key text NULL
    CHECK (preset_key IS NULL OR preset_key = ANY (ARRAY['kitchen'::text, 'waiter'::text, 'cashier'::text, 'frontdesk'::text])),
  permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  disabled_at timestamptz NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT restaurant_roles_name_not_blank CHECK (length(trim(name)) > 0)
);

CREATE UNIQUE INDEX restaurant_roles_one_preset_per_restaurant
  ON public.restaurant_roles (restaurant_id, preset_key)
  WHERE preset_key IS NOT NULL;

CREATE UNIQUE INDEX restaurant_roles_unique_name_per_restaurant
  ON public.restaurant_roles (restaurant_id, lower(trim(name)));

CREATE INDEX restaurant_roles_restaurant_id_idx ON public.restaurant_roles (restaurant_id);

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS permissions_version integer NOT NULL DEFAULT 0;

ALTER TABLE public.restaurant_staff_accounts
  ADD COLUMN IF NOT EXISTS role_id uuid REFERENCES public.restaurant_roles (id) ON DELETE RESTRICT;

-- Allow custom role label on staff.role for RLS (capabilities enforced in app).
ALTER TABLE public.restaurant_staff_accounts
  DROP CONSTRAINT IF EXISTS restaurant_staff_accounts_role_check;

ALTER TABLE public.restaurant_staff_accounts
  ADD CONSTRAINT restaurant_staff_accounts_role_check
  CHECK (
    role = ANY (
      ARRAY[
        'kitchen'::text,
        'waiter'::text,
        'cashier'::text,
        'frontdesk'::text,
        'print_agent'::text,
        'custom'::text
      ]
    )
  );

-- Seed presets for every restaurant
INSERT INTO public.restaurant_roles (restaurant_id, name, preset_key, permissions, sort_order)
SELECT
  r.id,
  v.name,
  v.preset_key,
  v.permissions::jsonb,
  v.sort_order
FROM public.restaurants r
CROSS JOIN (
  VALUES
    (
      '厨房'::text,
      'kitchen'::text,
      '["floor.kitchen_board.view","orders.kitchen_update"]'::text,
      0
    ),
    (
      '服务员',
      'waiter',
      '["dashboard.waiter_board.view","floor.waiter_board.view","tables.open_session","tables.transfer","tables.merge","orders.append","orders.edit","orders.print_receipt","buffet.post_to_table"]',
      1
    ),
    (
      '收银员',
      'cashier',
      '["dashboard.waiter_board.view","dashboard.checkout.view","checkout.confirm_payment","checkout.apply_discount","checkout.assist_bill","checkout.open_pending_tables","print_agent.receipt_printers.read","tables.open_session","tables.checkout_close","tables.transfer","tables.merge","orders.append","orders.edit","orders.menu_decrement","orders.print_receipt","buffet.post_to_table","floor.waiter_board.view"]',
      2
    ),
    (
      '前台',
      'frontdesk',
      '["dashboard.overview.view","dashboard.checkout.view","dashboard.orders.view","dashboard.tables.view","dashboard.menu.view","dashboard.waiter_board.view","dashboard.kitchen_shortcut.view","checkout.confirm_payment","checkout.apply_discount","checkout.request_whole_table","checkout.assist_bill","checkout.print_pre_bill","checkout.open_pending_tables","print_agent.receipt_printers.read","tables.manage","tables.open_session","tables.checkout_close","tables.force_close","tables.transfer","tables.merge","orders.append","orders.edit","orders.menu_decrement","orders.print_receipt","buffet.post_to_table","floor.waiter_board.view"]',
      3
    )
) AS v(name, preset_key, permissions, sort_order)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.restaurant_roles existing
  WHERE existing.restaurant_id = r.id
    AND existing.preset_key = v.preset_key
);

-- Bind existing human staff to preset roles
UPDATE public.restaurant_staff_accounts sa
SET role_id = rr.id
FROM public.restaurant_roles rr
WHERE sa.restaurant_id = rr.restaurant_id
  AND sa.role = rr.preset_key
  AND sa.role_id IS NULL
  AND sa.role <> 'print_agent';

CREATE INDEX IF NOT EXISTS restaurant_staff_accounts_role_id_idx
  ON public.restaurant_staff_accounts (role_id);

-- Login gate helper: active staff whose role row is enabled (or print_agent without role_id)
CREATE OR REPLACE FUNCTION public.is_active_restaurant_staff(
  p_restaurant_id uuid,
  p_roles text[] DEFAULT ARRAY['kitchen'::text, 'waiter'::text]
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.restaurant_staff_accounts a
    LEFT JOIN public.restaurant_roles rr ON rr.id = a.role_id
    WHERE a.restaurant_id = p_restaurant_id
      AND a.user_id = auth.uid()
      AND a.disabled_at IS NULL
      AND a.role = ANY (p_roles)
      AND (
        a.role = 'print_agent'
        OR (a.role_id IS NOT NULL AND rr.disabled_at IS NULL)
      )
  );
$$;

REVOKE ALL ON FUNCTION public.is_active_restaurant_staff(uuid, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_restaurant_staff(uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_restaurant_staff(uuid, text[]) TO service_role;

-- Broaden operational RLS to include custom staff roles (fine-grained auth is app capabilities)
-- bill_splits / orders frontdesk policies → any desk-like + custom
DROP POLICY IF EXISTS "bill_splits_frontdesk_select" ON public.bill_splits;
CREATE POLICY "bill_splits_frontdesk_select"
  ON public.bill_splits
  FOR SELECT
  TO authenticated
  USING (
    public.is_active_restaurant_staff(
      restaurant_id,
      ARRAY['frontdesk'::text, 'cashier'::text, 'custom'::text]
    )
  );

DROP POLICY IF EXISTS "orders_frontdesk_select" ON public.orders;
CREATE POLICY "orders_frontdesk_select"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (
    public.is_active_restaurant_staff(
      restaurant_id,
      ARRAY['frontdesk'::text, 'cashier'::text, 'waiter'::text, 'custom'::text]
    )
  );

ALTER TABLE public.restaurant_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "restaurant_roles_owner_all"
  ON public.restaurant_roles
  FOR ALL
  TO authenticated
  USING (
    restaurant_id IN (
      SELECT id FROM public.restaurants WHERE owner_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    restaurant_id IN (
      SELECT id FROM public.restaurants WHERE owner_id = (SELECT auth.uid())
    )
  );

-- Staff may read own restaurant roles (for UI labels); writes only via owner/service
CREATE POLICY "restaurant_roles_staff_select"
  ON public.restaurant_roles
  FOR SELECT
  TO authenticated
  USING (
    public.is_active_restaurant_staff(
      restaurant_id,
      ARRAY['kitchen'::text, 'waiter'::text, 'cashier'::text, 'frontdesk'::text, 'custom'::text]
    )
  );
