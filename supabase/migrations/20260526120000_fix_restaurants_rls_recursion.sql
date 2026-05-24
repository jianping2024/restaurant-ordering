-- Break infinite RLS recursion between restaurants and restaurant_staff_accounts:
-- restaurants_staff_select_own → restaurant_staff_accounts → owner policy → restaurants → …

create or replace function public.auth_owned_restaurant_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.restaurants where owner_id = auth.uid();
$$;

create or replace function public.auth_staff_restaurant_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select restaurant_id
  from public.restaurant_staff_accounts
  where user_id = auth.uid()
    and disabled_at is null;
$$;

revoke all on function public.auth_owned_restaurant_ids() from public;
grant execute on function public.auth_owned_restaurant_ids() to authenticated;

revoke all on function public.auth_staff_restaurant_ids() from public;
grant execute on function public.auth_staff_restaurant_ids() to authenticated;

drop policy if exists restaurants_staff_select_own on public.restaurants;
create policy restaurants_staff_select_own
  on public.restaurants
  for select
  to authenticated
  using (id in (select public.auth_staff_restaurant_ids()));

drop policy if exists restaurant_staff_accounts_owner_all on public.restaurant_staff_accounts;
create policy restaurant_staff_accounts_owner_all
  on public.restaurant_staff_accounts
  for all
  to authenticated
  using (restaurant_id in (select public.auth_owned_restaurant_ids()))
  with check (restaurant_id in (select public.auth_owned_restaurant_ids()));
