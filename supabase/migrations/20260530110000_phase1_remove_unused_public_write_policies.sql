-- Phase 1 security hardening: remove unused implicit-PUBLIC write policies.
-- Production customer ordering creates table_sessions and updates orders via
-- service-role API routes, so anon direct writes are no longer required here.

drop policy if exists "table_sessions_insert_public" on public.table_sessions;
drop policy if exists "orders_update_active_session" on public.orders;
