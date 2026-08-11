-- Per-restaurant operation log retention (calendar days).
-- Range: 7-90 days, default: 7.
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS operation_log_retention_days integer NOT NULL DEFAULT 7
  CHECK (operation_log_retention_days >= 7 AND operation_log_retention_days <= 90);
