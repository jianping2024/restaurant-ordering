-- DEV / STAGING ONLY — never run against production.
-- Full wipe of order-related operational data (same tables the old migration truncated).
-- Run: supabase db query -f scripts/dev-wipe-order-data.sql --linked
--
-- For a softer reset that closes sessions instead of deleting history, use:
-- scripts/cleanup-operational-data.sql

begin;

truncate table
  public.dish_feedback,
  public.feedback_sessions,
  public.print_jobs,
  public.bill_splits,
  public.orders,
  public.table_sessions
restart identity cascade;

commit;
