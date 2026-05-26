-- Phase 2 security hardening: remove remaining implicit-PUBLIC checkout writes.
-- Customer checkout requests now go through a service-role API route that
-- validates slug, table_id, active session, current orders, and split totals.

drop policy if exists "bill_splits_insert_session" on public.bill_splits;
drop policy if exists "bill_splits_update_session" on public.bill_splits;
drop policy if exists "table_sessions_update_guest_flow" on public.table_sessions;
