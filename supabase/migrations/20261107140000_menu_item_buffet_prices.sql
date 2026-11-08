-- 菜品按套餐单独定价：这桌当前套餐对这道菜有配置就用配置价，否则原价；外卖不看此表。
-- 唯一取价 TS：lib/instore-takeaway menuItemUnitPriceForChannel。
-- 「这桌当前套餐」SQL 唯一函数 table_session_current_buffet_id（TS 孪生：lib/buffet-order currentTableBuffetLine）。

-- Composite FK targets (id is already unique; this pins dish/buffet to one restaurant).
ALTER TABLE public.menu_items
  DROP CONSTRAINT IF EXISTS menu_items_restaurant_id_id_key;
ALTER TABLE public.menu_items
  ADD CONSTRAINT menu_items_restaurant_id_id_key UNIQUE (restaurant_id, id);

ALTER TABLE public.buffets
  DROP CONSTRAINT IF EXISTS buffets_restaurant_id_id_key;
ALTER TABLE public.buffets
  ADD CONSTRAINT buffets_restaurant_id_id_key UNIQUE (restaurant_id, id);

CREATE TABLE IF NOT EXISTS public.menu_item_buffet_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  menu_item_id uuid NOT NULL,
  buffet_id uuid NOT NULL,
  price numeric(10, 2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT menu_item_buffet_prices_price_nonnegative CHECK (price >= 0),
  CONSTRAINT menu_item_buffet_prices_item_buffet_key UNIQUE (menu_item_id, buffet_id),
  CONSTRAINT menu_item_buffet_prices_menu_item_fkey
    FOREIGN KEY (restaurant_id, menu_item_id)
    REFERENCES public.menu_items (restaurant_id, id) ON DELETE CASCADE,
  CONSTRAINT menu_item_buffet_prices_buffet_fkey
    FOREIGN KEY (restaurant_id, buffet_id)
    REFERENCES public.buffets (restaurant_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_menu_item_buffet_prices_restaurant
  ON public.menu_item_buffet_prices (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_menu_item_buffet_prices_buffet
  ON public.menu_item_buffet_prices (restaurant_id, buffet_id);

DROP TRIGGER IF EXISTS menu_item_buffet_prices_updated_at ON public.menu_item_buffet_prices;
CREATE TRIGGER menu_item_buffet_prices_updated_at
  BEFORE UPDATE ON public.menu_item_buffet_prices
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.menu_item_buffet_prices IS
  'Per-buffet dine-in unit price for one dish. Table current buffet has a row → that price; else menu_items.price. Takeaway ignores it.';

ALTER TABLE public.menu_item_buffet_prices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS menu_item_buffet_prices_public_read ON public.menu_item_buffet_prices;
CREATE POLICY menu_item_buffet_prices_public_read ON public.menu_item_buffet_prices
  FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS menu_item_buffet_prices_owner_all ON public.menu_item_buffet_prices;
CREATE POLICY menu_item_buffet_prices_owner_all ON public.menu_item_buffet_prices
  AS PERMISSIVE FOR ALL TO authenticated
  USING ((restaurant_id IN (
    SELECT restaurants.id FROM public.restaurants
    WHERE restaurants.owner_id = (select auth.uid())
  )))
  WITH CHECK ((restaurant_id IN (
    SELECT restaurants.id FROM public.restaurants
    WHERE restaurants.owner_id = (select auth.uid())
  )));

DROP POLICY IF EXISTS menu_item_buffet_prices_staff_menu_all ON public.menu_item_buffet_prices;
CREATE POLICY menu_item_buffet_prices_staff_menu_all ON public.menu_item_buffet_prices
  FOR ALL TO authenticated
  USING (public.staff_has_restaurant_permission(restaurant_id, ARRAY['dashboard.menu.view'::text]))
  WITH CHECK (public.staff_has_restaurant_permission(restaurant_id, ARRAY['dashboard.menu.view'::text]));

GRANT SELECT ON public.menu_item_buffet_prices TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.menu_item_buffet_prices TO authenticated;
GRANT ALL ON public.menu_item_buffet_prices TO service_role;

-- Sole atomic replace of one dish's buffet price set (dashboard dish form save).
CREATE OR REPLACE FUNCTION public.replace_menu_item_buffet_prices(
  p_restaurant_id uuid,
  p_menu_item_id uuid,
  p_prices jsonb
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_entry jsonb;
  v_buffet_id uuid;
  v_price numeric;
  v_buffet_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  IF jsonb_typeof(coalesce(p_prices, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'invalid_buffet_prices';
  END IF;

  FOR v_entry IN SELECT value FROM jsonb_array_elements(coalesce(p_prices, '[]'::jsonb)) LOOP
    v_buffet_id := nullif(v_entry->>'buffet_id', '')::uuid;
    v_price := (v_entry->>'price')::numeric;
    IF v_buffet_id IS NULL OR v_price IS NULL OR v_price < 0 THEN
      RAISE EXCEPTION 'invalid_buffet_prices';
    END IF;
    IF v_buffet_id = ANY (v_buffet_ids) THEN
      RAISE EXCEPTION 'duplicate_buffet_price';
    END IF;
    v_buffet_ids := v_buffet_ids || v_buffet_id;
  END LOOP;

  DELETE FROM public.menu_item_buffet_prices
  WHERE restaurant_id = p_restaurant_id
    AND menu_item_id = p_menu_item_id
    AND NOT (buffet_id = ANY (v_buffet_ids));

  INSERT INTO public.menu_item_buffet_prices (restaurant_id, menu_item_id, buffet_id, price)
  SELECT
    p_restaurant_id,
    p_menu_item_id,
    (e->>'buffet_id')::uuid,
    round((e->>'price')::numeric, 2)
  FROM jsonb_array_elements(coalesce(p_prices, '[]'::jsonb)) AS e
  ON CONFLICT (menu_item_id, buffet_id)
  DO UPDATE SET price = excluded.price;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_menu_item_buffet_prices(uuid, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_menu_item_buffet_prices(uuid, uuid, jsonb) TO service_role;

-- Sole SQL read of a table session's current buffet: newest active (not voided)
-- buffet_base line with a buffet_id across the session's orders. NULL = no buffet.
-- TS twin: lib/buffet-order currentTableBuffetLine (parity test: buffet-current-parity.test.ts).
-- Also a PostgREST computed column: select `table_session_current_buffet_id` on table_sessions.
CREATE OR REPLACE FUNCTION public.table_session_current_buffet_id(s public.table_sessions)
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (it->>'buffet_id')::uuid
  FROM public.orders o
  CROSS JOIN LATERAL jsonb_array_elements(coalesce(o.items, '[]'::jsonb)) AS it
  WHERE o.session_id = s.id
    AND it->>'kind' = 'buffet_base'
    AND coalesce(it->>'item_status', '') <> 'voided'
    AND nullif(it->>'buffet_id', '') IS NOT NULL
  ORDER BY coalesce(it->>'added_at', '') DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.table_session_current_buffet_id(public.table_sessions) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.table_session_current_buffet_id(public.table_sessions)
  TO authenticated, service_role;
