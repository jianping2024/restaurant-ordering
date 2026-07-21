-- Narrow waiter board live order reads: active session status + recency.
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_status_updated_at
  ON public.orders (restaurant_id, status, updated_at DESC);
