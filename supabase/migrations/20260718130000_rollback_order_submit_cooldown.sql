-- Rollback: remove order submit cooldown config/column added in 20260717120000.

ALTER TABLE public.restaurants
  DROP CONSTRAINT IF EXISTS restaurants_order_submit_cooldown_seconds_check;
ALTER TABLE public.restaurants
  DROP COLUMN IF EXISTS order_submit_cooldown_seconds;
ALTER TABLE public.table_sessions
  DROP COLUMN IF EXISTS last_menu_append_at;
