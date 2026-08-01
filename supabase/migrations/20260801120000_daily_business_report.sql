-- On-prem daily business report: Ops toggle + sealed daily top-10 menu items.
-- Cloud SaaS keeps default false; nightly close stays on Vercel cron.

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS daily_business_report_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.restaurants.daily_business_report_enabled IS
  'Platform-only (Ops): when true on on_prem, store daily-cutover uploads sealed Lisbon-day KPIs to platform. Not an owner feature_flag.';

CREATE TABLE IF NOT EXISTS public.analytics_daily_menu_item_stats (
  restaurant_id uuid NOT NULL REFERENCES public.restaurants (id) ON DELETE CASCADE,
  business_date date NOT NULL,
  rank smallint NOT NULL,
  item_id text NOT NULL,
  name_pt text NOT NULL,
  name_en text,
  name_zh text,
  consumed_quantity numeric(12, 3) NOT NULL DEFAULT 0,
  amount numeric(12, 2) NOT NULL DEFAULT 0,
  sealed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (restaurant_id, business_date, rank),
  CONSTRAINT analytics_daily_menu_item_stats_rank_range CHECK (rank >= 1 AND rank <= 10),
  CONSTRAINT analytics_daily_menu_item_stats_qty_nonnegative CHECK (consumed_quantity >= 0),
  CONSTRAINT analytics_daily_menu_item_stats_amount_nonnegative CHECK (amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_analytics_daily_menu_item_stats_restaurant_date
  ON public.analytics_daily_menu_item_stats (restaurant_id, business_date DESC);

ALTER TABLE public.analytics_daily_menu_item_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS analytics_daily_menu_item_stats_owner_select
  ON public.analytics_daily_menu_item_stats;
CREATE POLICY analytics_daily_menu_item_stats_owner_select
  ON public.analytics_daily_menu_item_stats
  FOR SELECT
  TO authenticated
  USING (
    restaurant_id IN (
      SELECT r.id FROM public.restaurants r WHERE r.owner_id = auth.uid()
    )
  );

COMMENT ON TABLE public.analytics_daily_menu_item_stats IS
  'Sealed Lisbon-day top menu items by consumed quantity (max 10 ranks); written with analytics_daily_restaurant_stats.';
