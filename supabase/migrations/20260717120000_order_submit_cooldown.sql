-- Per-session menu append cooldown (guest + staff-assisted); owner configures 2–60 sec on restaurants.

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS order_submit_cooldown_seconds integer NOT NULL DEFAULT 5
  CONSTRAINT restaurants_order_submit_cooldown_seconds_check
    CHECK (order_submit_cooldown_seconds >= 2 AND order_submit_cooldown_seconds <= 60);
ALTER TABLE public.table_sessions
  ADD COLUMN IF NOT EXISTS last_menu_append_at timestamptz;
COMMENT ON COLUMN public.restaurants.order_submit_cooldown_seconds IS
  'Minimum seconds between menu append submits for the same table session (guest and waiter-assisted).';
COMMENT ON COLUMN public.table_sessions.last_menu_append_at IS
  'Timestamp of the last successful menu append for this session; drives order submit cooldown.';
