-- Cashier staff role: checkout requests only (dashboard).

alter table public.restaurant_staff_accounts
  drop constraint if exists restaurant_staff_accounts_role_check;

alter table public.restaurant_staff_accounts
  add constraint restaurant_staff_accounts_role_check
  check (role in ('kitchen', 'waiter', 'cashier'));

drop policy if exists bill_splits_cashier_select on public.bill_splits;
create policy bill_splits_cashier_select
  on public.bill_splits
  for select
  to authenticated
  using (public.is_active_restaurant_staff(restaurant_id, array['cashier']::text[]));

drop policy if exists orders_cashier_select on public.orders;
create policy orders_cashier_select
  on public.orders
  for select
  to authenticated
  using (public.is_active_restaurant_staff(restaurant_id, array['cashier']::text[]));
