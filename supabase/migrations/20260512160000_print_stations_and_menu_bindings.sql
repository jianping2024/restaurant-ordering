-- print_stations: per-restaurant production windows for station_ticket routing.
-- menu_categories / menu_items optional print_station_id (COALESCE(item, category) at enqueue time).

create table if not exists public.print_stations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name_pt text not null,
  name_en text,
  name_zh text,
  sort_order integer not null default 0,
  ticket_layout text not null default 'standard'
    check (ticket_layout in ('kitchen', 'beverage', 'standard')),
  created_at timestamptz not null default now()
);

create index if not exists idx_print_stations_restaurant
  on public.print_stations(restaurant_id, sort_order, created_at);

alter table public.print_stations enable row level security;

drop policy if exists "print_stations_public_read" on public.print_stations;
create policy "print_stations_public_read"
  on public.print_stations for select
  using (true);

drop policy if exists "print_stations_owner_all" on public.print_stations;
create policy "print_stations_owner_all"
  on public.print_stations for all
  using (
    restaurant_id in (
      select id from public.restaurants where owner_id = auth.uid()
    )
  );

alter table public.menu_categories
  add column if not exists print_station_id uuid references public.print_stations(id) on delete set null;

create index if not exists idx_menu_categories_print_station
  on public.menu_categories(print_station_id)
  where print_station_id is not null;

alter table public.menu_items
  add column if not exists print_station_id uuid references public.print_stations(id) on delete set null;

create index if not exists idx_menu_items_print_station
  on public.menu_items(restaurant_id, print_station_id)
  where print_station_id is not null;

-- Ensure print_station_id points at a station owned by the same restaurant (FK alone is insufficient).
create or replace function public.enforce_print_station_same_restaurant()
returns trigger
language plpgsql as $$
begin
  if new.print_station_id is null then
    return new;
  end if;
  if not exists (
    select 1
    from public.print_stations ps
    where ps.id = new.print_station_id
      and ps.restaurant_id = new.restaurant_id
  ) then
    raise exception 'print_station_id must reference print_stations for the same restaurant';
  end if;
  return new;
end;
$$;

drop trigger if exists menu_categories_print_station_restaurant on public.menu_categories;
create trigger menu_categories_print_station_restaurant
  before insert or update of print_station_id, restaurant_id
  on public.menu_categories
  for each row
  execute function public.enforce_print_station_same_restaurant();

drop trigger if exists menu_items_print_station_restaurant on public.menu_items;
create trigger menu_items_print_station_restaurant
  before insert or update of print_station_id, restaurant_id
  on public.menu_items
  for each row
  execute function public.enforce_print_station_same_restaurant();

-- Seed two common stations per restaurant (idempotent: one row per ticket_layout per restaurant).
insert into public.print_stations (restaurant_id, name_pt, name_en, name_zh, sort_order, ticket_layout)
select r.id, 'Cozinha', 'Kitchen', '后厨', 0, 'kitchen'
from public.restaurants r
where not exists (
  select 1
  from public.print_stations ps
  where ps.restaurant_id = r.id
    and ps.ticket_layout = 'kitchen'
);

insert into public.print_stations (restaurant_id, name_pt, name_en, name_zh, sort_order, ticket_layout)
select r.id, 'Bar', 'Bar', '吧台', 1, 'beverage'
from public.restaurants r
where not exists (
  select 1
  from public.print_stations ps
  where ps.restaurant_id = r.id
    and ps.ticket_layout = 'beverage'
);
