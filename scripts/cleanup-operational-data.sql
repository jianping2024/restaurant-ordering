-- One-time dev/staging reset: clear live orders and release all tables.
-- For a full TRUNCATE of order history, use scripts/dev-wipe-order-data.sql instead.
-- Run: supabase db query -f scripts/cleanup-operational-data.sql --linked

begin;

delete from public.dish_feedback;
delete from public.feedback_sessions;
delete from public.print_jobs;
delete from public.bill_splits;
delete from public.orders;

update public.table_sessions
set
  status = 'closed',
  closed_at = coalesce(closed_at, now()),
  closed_reason = coalesce(closed_reason, 'owner_closed')
where status in ('open', 'billing');

commit;
