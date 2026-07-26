-- Daily sealed restaurant metrics for value analytics (Lisbon business day).
-- Written by service-role seal/backfill only; owners read via Next.js admin client.

CREATE TABLE IF NOT EXISTS public.analytics_daily_restaurant_stats (
  restaurant_id uuid NOT NULL REFERENCES public.restaurants (id) ON DELETE CASCADE,
  business_date date NOT NULL,
  revenue numeric(12, 2) NOT NULL DEFAULT 0,
  adult_count integer NOT NULL DEFAULT 0,
  child_count integer NOT NULL DEFAULT 0,
  customer_count integer NOT NULL DEFAULT 0,
  qualifying_session_count integer NOT NULL DEFAULT 0,
  sealed_at timestamptz NOT NULL DEFAULT now(),
  computed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (restaurant_id, business_date),
  CONSTRAINT analytics_daily_restaurant_stats_counts_nonnegative CHECK (
    adult_count >= 0
    AND child_count >= 0
    AND customer_count >= 0
    AND qualifying_session_count >= 0
  )
);

CREATE INDEX IF NOT EXISTS idx_analytics_daily_restaurant_stats_restaurant_date
  ON public.analytics_daily_restaurant_stats (restaurant_id, business_date DESC);

ALTER TABLE public.analytics_daily_restaurant_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS analytics_daily_restaurant_stats_owner_select
  ON public.analytics_daily_restaurant_stats;
CREATE POLICY analytics_daily_restaurant_stats_owner_select
  ON public.analytics_daily_restaurant_stats
  FOR SELECT
  TO authenticated
  USING (
    restaurant_id IN (
      SELECT r.id FROM public.restaurants r WHERE r.owner_id = auth.uid()
    )
  );

COMMENT ON TABLE public.analytics_daily_restaurant_stats IS
  'Sealed Lisbon-day value-analytics metrics; today is computed live and not stored here until sealed.';
