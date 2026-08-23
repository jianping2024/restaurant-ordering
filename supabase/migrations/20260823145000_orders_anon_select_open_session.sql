-- Customer menu Realtime: anon SELECT + CDC only for orders on open/billing sessions.
-- Replaces permissive orders_public_read (using true) for anon.
-- Kitchen staff Realtime still needs restaurant-wide SELECT (incl. close-table bumps).

DROP POLICY IF EXISTS "orders_public_read" ON public.orders;
DROP POLICY IF EXISTS orders_public_read ON public.orders;

CREATE POLICY orders_anon_select_open_session
  ON public.orders
  FOR SELECT
  TO anon
  USING (public.table_session_is_open_or_billing(session_id));

CREATE POLICY orders_kitchen_staff_select
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (
    public.is_active_restaurant_staff(
      restaurant_id,
      ARRAY['kitchen'::text]
    )
  );
