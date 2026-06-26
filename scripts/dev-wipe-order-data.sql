-- DEV / STAGING ONLY — never run against production.
-- Full wipe of order-related operational data.
-- Preserves: restaurants, menu_*, restaurant_staff_accounts, restaurant_tables,
--   buffets*, print_stations, print_agent_* (devices/pairings), settings.
--
-- Local:  supabase db query "truncate table public.dish_feedback, public.feedback_sessions, public.print_jobs, public.bill_splits, public.orders, public.table_sessions restart identity cascade;"
-- Linked: same one-liner with --linked (confirm project first).
--
-- Note: `supabase db query -f` does not support BEGIN/COMMIT in file; use psql -f or one-liner above.

truncate table
  public.dish_feedback,
  public.feedback_sessions,
  public.print_jobs,
  public.bill_splits,
  public.orders,
  public.table_sessions
restart identity cascade;
