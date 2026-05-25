-- Configurable table numbers per restaurant (up to 200, custom integers).
alter table public.restaurants
  add column if not exists table_numbers integer[];

update public.restaurants
  set table_numbers = array[1,2,3,4,5,6,7,8,9,10]::integer[]
  where table_numbers is null;

alter table public.restaurants
  alter column table_numbers set default array[1,2,3,4,5,6,7,8,9,10]::integer[];

alter table public.restaurants
  alter column table_numbers set not null;

alter table public.restaurants
  drop constraint if exists restaurants_table_numbers_cardinality_check;

alter table public.restaurants
  add constraint restaurants_table_numbers_cardinality_check
  check (
    cardinality(table_numbers) >= 1
    and cardinality(table_numbers) <= 200
  );

-- Rename a table number across sessions, orders, and print job payloads (owner only).
create or replace function public.rename_restaurant_table_number(
  p_restaurant_id uuid,
  p_from_table integer,
  p_to_table integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_from_table = p_to_table then
    return;
  end if;

  if not exists (
    select 1 from public.restaurants
    where id = p_restaurant_id and owner_id = auth.uid()
  ) then
    raise exception 'forbidden';
  end if;

  if exists (
    select 1 from public.table_sessions
    where restaurant_id = p_restaurant_id
      and table_number = p_to_table
      and status in ('open', 'billing')
  ) then
    raise exception 'target_table_has_active_session';
  end if;

  update public.table_sessions
  set table_number = p_to_table
  where restaurant_id = p_restaurant_id and table_number = p_from_table;

  update public.orders
  set table_number = p_to_table
  where restaurant_id = p_restaurant_id and table_number = p_from_table;

  update public.print_jobs
  set payload = jsonb_set(
    coalesce(payload, '{}'::jsonb),
    '{table_number}',
    to_jsonb(p_to_table),
    true
  )
  where restaurant_id = p_restaurant_id and table_number = p_from_table;
end;
$$;

grant execute on function public.rename_restaurant_table_number(uuid, integer, integer) to authenticated;

drop view if exists public.restaurants_public;

create view public.restaurants_public
with (security_invoker = false) as
  select
    id,
    name,
    slug,
    logo_url,
    address,
    phone,
    plan,
    geo_latitude,
    geo_longitude,
    print_locale,
    created_at,
    order_radius_meters,
    table_numbers
  from public.restaurants;

grant select on public.restaurants_public to anon, authenticated;
