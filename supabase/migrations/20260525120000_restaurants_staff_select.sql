-- Cashier (and other staff) need to read their restaurant row for dashboard/checkout.

drop policy if exists restaurants_staff_select_own on public.restaurants;
create policy restaurants_staff_select_own
  on public.restaurants
  for select
  to authenticated
  using (
    id in (
      select a.restaurant_id
      from public.restaurant_staff_accounts a
      where a.user_id = auth.uid()
        and a.disabled_at is null
    )
  );
