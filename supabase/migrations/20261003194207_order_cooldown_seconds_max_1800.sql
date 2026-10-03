-- Expand restaurant order_cooldown_seconds CHECK from 5–60 to 5–1800.
ALTER TABLE public.restaurants
  DROP CONSTRAINT IF EXISTS restaurants_order_cooldown_seconds_check;

ALTER TABLE public.restaurants
  ADD CONSTRAINT restaurants_order_cooldown_seconds_check
  CHECK (order_cooldown_seconds >= 5 AND order_cooldown_seconds <= 1800);
