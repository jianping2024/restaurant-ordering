-- Per-restaurant feature toggles (extensible jsonb map).
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS feature_flags jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.restaurants.feature_flags IS
  'Owner-controlled feature switches, e.g. {"kitchen_board": true}. Missing keys use app defaults.';
