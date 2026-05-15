-- Owner preview: same Supabase session as /dashboard can open /[slug]/kitchen and /[slug]/waiter
-- without a staff row. Allow authenticated owner to read board data for own restaurant.

create policy orders_owner_select
  on public.orders
  for select
  to authenticated
  using (
    restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
  );

create policy orders_owner_update
  on public.orders
  for update
  to authenticated
  using (
    restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
  )
  with check (
    restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
  );

create policy table_sessions_owner_select
  on public.table_sessions
  for select
  to authenticated
  using (
    restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
  );

create policy bill_splits_owner_select
  on public.bill_splits
  for select
  to authenticated
  using (
    restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
  );
