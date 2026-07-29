-- Owner preset staff role: extend checks, seed preset, broaden desk-like RLS for owner staff.

ALTER TABLE public.restaurant_roles DROP CONSTRAINT IF EXISTS restaurant_roles_preset_key_check;
ALTER TABLE public.restaurant_roles
  ADD CONSTRAINT restaurant_roles_preset_key_check
  CHECK (
    preset_key IS NULL
    OR preset_key = ANY (
      ARRAY['kitchen'::text, 'waiter'::text, 'cashier'::text, 'frontdesk'::text, 'owner'::text]
    )
  );

ALTER TABLE public.restaurant_staff_accounts DROP CONSTRAINT IF EXISTS restaurant_staff_accounts_role_check;
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
        'custom'::text,
        'owner'::text
      ]
    )
  );

INSERT INTO public.restaurant_roles (restaurant_id, name, preset_key, permissions, sort_order)
SELECT
  r.id,
  '店主'::text,
  'owner'::text,
  '["dashboard.overview.view","dashboard.checkout.view","dashboard.orders.view","dashboard.tables.view","dashboard.menu.view","dashboard.waiter_board.view","dashboard.kitchen_shortcut.view","checkout.confirm_payment","checkout.apply_discount","checkout.request_whole_table","checkout.assist_bill","checkout.print_pre_bill","checkout.open_pending_tables","print_agent.receipt_printers.read","tables.manage","tables.open_session","tables.checkout_close","tables.force_close","tables.transfer","tables.merge","orders.append","orders.edit","orders.menu_decrement","orders.print_receipt","buffet.post_to_table","floor.waiter_board.view","dashboard.settings.view","settings.profile.manage","settings.staff.manage"]'::jsonb,
  5
FROM public.restaurants r
WHERE NOT EXISTS (
  SELECT 1
  FROM public.restaurant_roles rr
  WHERE rr.restaurant_id = r.id
    AND rr.preset_key = 'owner'
);

UPDATE public.restaurant_staff_accounts sa
SET role_id = rr.id
FROM public.restaurant_roles rr
WHERE sa.restaurant_id = rr.restaurant_id
  AND sa.role = 'owner'
  AND rr.preset_key = 'owner'
  AND sa.role_id IS NULL;

DROP POLICY IF EXISTS "bill_splits_frontdesk_select" ON public.bill_splits;
CREATE POLICY "bill_splits_frontdesk_select"
  ON public.bill_splits
  FOR SELECT
  TO authenticated
  USING (
    public.is_active_restaurant_staff(
      restaurant_id,
      ARRAY['frontdesk'::text, 'cashier'::text, 'custom'::text, 'owner'::text]
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
      ARRAY['frontdesk'::text, 'cashier'::text, 'waiter'::text, 'custom'::text, 'owner'::text]
    )
  );

DROP POLICY IF EXISTS "restaurant_roles_staff_select" ON public.restaurant_roles;
CREATE POLICY "restaurant_roles_staff_select"
  ON public.restaurant_roles
  FOR SELECT
  TO authenticated
  USING (
    public.is_active_restaurant_staff(
      restaurant_id,
      ARRAY[
        'kitchen'::text,
        'waiter'::text,
        'cashier'::text,
        'frontdesk'::text,
        'custom'::text,
        'owner'::text
      ]
    )
  );

DROP POLICY IF EXISTS menu_categories_frontdesk_all ON public.menu_categories;
CREATE POLICY menu_categories_frontdesk_all ON public.menu_categories
  FOR ALL
  TO authenticated
  USING (
    public.is_active_restaurant_staff(
      restaurant_id,
      ARRAY['frontdesk'::text, 'owner'::text]
    )
  )
  WITH CHECK (
    public.is_active_restaurant_staff(
      restaurant_id,
      ARRAY['frontdesk'::text, 'owner'::text]
    )
  );

DROP POLICY IF EXISTS menu_items_frontdesk_all ON public.menu_items;
CREATE POLICY menu_items_frontdesk_all ON public.menu_items
  FOR ALL
  TO authenticated
  USING (
    public.is_active_restaurant_staff(
      restaurant_id,
      ARRAY['frontdesk'::text, 'owner'::text]
    )
  )
  WITH CHECK (
    public.is_active_restaurant_staff(
      restaurant_id,
      ARRAY['frontdesk'::text, 'owner'::text]
    )
  );

DROP POLICY IF EXISTS print_stations_frontdesk_all ON public.print_stations;
CREATE POLICY print_stations_frontdesk_all ON public.print_stations
  FOR ALL
  TO authenticated
  USING (
    public.is_active_restaurant_staff(
      restaurant_id,
      ARRAY['frontdesk'::text, 'owner'::text]
    )
  )
  WITH CHECK (
    public.is_active_restaurant_staff(
      restaurant_id,
      ARRAY['frontdesk'::text, 'owner'::text]
    )
  );

DROP POLICY IF EXISTS table_session_events_staff_select ON public.table_session_events;
CREATE POLICY table_session_events_staff_select ON public.table_session_events
  FOR SELECT
  TO authenticated
  USING (
    public.is_active_restaurant_staff(
      restaurant_id,
      ARRAY['waiter'::text, 'frontdesk'::text, 'cashier'::text, 'owner'::text]
    )
  );
