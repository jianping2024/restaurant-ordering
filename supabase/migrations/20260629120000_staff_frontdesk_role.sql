-- Add frontdesk staff role for operational dashboard access (no restaurant settings).

alter table public.restaurant_staff_accounts
  drop constraint if exists restaurant_staff_accounts_role_check;
alter table public.restaurant_staff_accounts
  add constraint restaurant_staff_accounts_role_check
  check (role = any (array['kitchen'::text, 'waiter'::text, 'cashier'::text, 'frontdesk'::text]));
create policy "bill_splits_frontdesk_select"
  on public.bill_splits
  for select
  to authenticated
  using (public.is_active_restaurant_staff(restaurant_id, array['frontdesk'::text]));
create policy "orders_frontdesk_select"
  on public.orders
  for select
  to authenticated
  using (public.is_active_restaurant_staff(restaurant_id, array['frontdesk'::text]));
