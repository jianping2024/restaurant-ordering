-- Per-restaurant order append cooldown (customer ordering rate).
-- Range: 5-60 seconds, default: 5.
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS order_cooldown_seconds integer NOT NULL DEFAULT 5
  CHECK (order_cooldown_seconds >= 5 AND order_cooldown_seconds <= 60);

