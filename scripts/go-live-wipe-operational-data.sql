-- Go-live wipe: clear all order/session operational history and audit stats.
-- Preserves: restaurants, menu_*, restaurant_tables/groups, buffets*,
--   print_stations, print_agent_*, restaurant_staff_accounts, platform_admin_*.
--
-- Run (linked cloud): supabase db query --linked "$(cat scripts/go-live-wipe-operational-data.sql)"
-- Local Docker:       supabase db query "$(cat scripts/go-live-wipe-operational-data.sql)"

truncate table
  public.abnormal_operations,
  public.operation_logs,
  public.dish_feedback,
  public.feedback_sessions,
  public.print_jobs,
  public.bill_splits,
  public.orders,
  public.table_sessions
restart identity cascade;
