-- Value analytics: closed session lookups by restaurant + closed_at range.
CREATE INDEX IF NOT EXISTS idx_table_sessions_restaurant_closed_at
  ON public.table_sessions (restaurant_id, closed_at DESC)
  WHERE status = 'closed';
