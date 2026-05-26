-- Phase 3 security hardening: remove implicit-PUBLIC customer reads.
-- Customer menu/bill reads now go through service-role API routes scoped by
-- slug + table_id, so anon direct reads are no longer required for these tables.

drop policy if exists "table_sessions_select_public" on public.table_sessions;
drop policy if exists "orders_select_active_session" on public.orders;
drop policy if exists "bill_splits_select_session" on public.bill_splits;
