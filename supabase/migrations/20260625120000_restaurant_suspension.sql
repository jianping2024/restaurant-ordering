-- Platform ops: suspend / resume tenant restaurants

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS suspension_reason text;
CREATE INDEX IF NOT EXISTS idx_restaurants_suspended_at
  ON public.restaurants (suspended_at)
  WHERE suspended_at IS NOT NULL;
