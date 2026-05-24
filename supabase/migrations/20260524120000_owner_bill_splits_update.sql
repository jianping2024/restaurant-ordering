-- Dashboard owner can confirm checkout (update bill_splits + close sessions).

drop policy if exists bill_splits_owner_update on public.bill_splits;
create policy bill_splits_owner_update
  on public.bill_splits
  for update
  to authenticated
  using (
    restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
  )
  with check (
    restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
  );

drop policy if exists table_sessions_owner_update on public.table_sessions;
create policy table_sessions_owner_update
  on public.table_sessions
  for update
  to authenticated
  using (
    restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
  )
  with check (
    restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
  );
