-- Owner preview: same Supabase session as /dashboard can open /[slug]/kitchen and /[slug]/waiter
-- without a staff row. Allow authenticated owner to read board data for own restaurant.
-- orders_owner_update already exists in 20240101000000_initial_schema.sql.

drop policy if exists orders_owner_select on public.orders;
create policy orders_owner_select
  on public.orders
  for select
  to authenticated
  using (
    restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
  );

drop policy if exists table_sessions_owner_select on public.table_sessions;
create policy table_sessions_owner_select
  on public.table_sessions
  for select
  to authenticated
  using (
    restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
  );

drop policy if exists bill_splits_owner_select on public.bill_splits;
create policy bill_splits_owner_select
  on public.bill_splits
  for select
  to authenticated
  using (
    restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
  );
