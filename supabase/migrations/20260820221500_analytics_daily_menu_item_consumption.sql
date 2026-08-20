-- Full per-day menu-item consumption (all dishes), sealed with daily restaurant stats.
-- Sole durable source for value-analytics dish ranking over a date window.

CREATE TABLE IF NOT EXISTS public.analytics_daily_menu_item_consumption (
  restaurant_id uuid NOT NULL REFERENCES public.restaurants (id) ON DELETE CASCADE,
  business_date date NOT NULL,
  menu_item_id text NOT NULL,
  item_code text,
  name_pt text NOT NULL,
  name_en text,
  name_zh text,
  consumed_quantity numeric(12, 3) NOT NULL DEFAULT 0,
  amount numeric(12, 2) NOT NULL DEFAULT 0,
  sealed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (restaurant_id, business_date, menu_item_id),
  CONSTRAINT analytics_daily_menu_item_consumption_qty_nonnegative CHECK (consumed_quantity >= 0),
  CONSTRAINT analytics_daily_menu_item_consumption_amount_nonnegative CHECK (amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_analytics_daily_menu_item_consumption_restaurant_date
  ON public.analytics_daily_menu_item_consumption (restaurant_id, business_date DESC);

ALTER TABLE public.analytics_daily_menu_item_consumption ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS analytics_daily_menu_item_consumption_owner_select
  ON public.analytics_daily_menu_item_consumption;
CREATE POLICY analytics_daily_menu_item_consumption_owner_select
  ON public.analytics_daily_menu_item_consumption
  FOR SELECT
  TO authenticated
  USING (
    restaurant_id IN (
      SELECT r.id FROM public.restaurants r WHERE r.owner_id = auth.uid()
    )
  );

COMMENT ON TABLE public.analytics_daily_menu_item_consumption IS
  'Sealed Lisbon-day full menu-item consumption by qty; sole source for value-analytics dish ranking windows.';
