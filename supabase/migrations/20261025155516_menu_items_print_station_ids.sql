-- Dish print routing: one ordered list of stations (empty = inherit category).
-- Replaces menu_items.print_station_id (single) with print_station_ids (uuid[]).

alter table public.menu_items
  add column if not exists print_station_ids uuid[] not null default '{}';

update public.menu_items
set print_station_ids = array[print_station_id]
where print_station_id is not null
  and (print_station_ids is null or cardinality(print_station_ids) = 0);

alter table public.menu_items
  drop constraint if exists menu_items_print_station_id_fkey;

drop trigger if exists menu_items_print_station_restaurant on public.menu_items;

drop index if exists public.idx_menu_items_print_station;

alter table public.menu_items
  drop column if exists print_station_id;

create index if not exists idx_menu_items_print_station_ids
  on public.menu_items using gin (print_station_ids);

-- Same-restaurant check for every id in the array (categories keep single-id trigger).
create or replace function public.enforce_menu_item_print_station_ids_same_restaurant()
returns trigger
language plpgsql
as $$
declare
  sid uuid;
  ok boolean;
begin
  if new.print_station_ids is null then
    new.print_station_ids := '{}';
  end if;

  foreach sid in array new.print_station_ids
  loop
    select exists (
      select 1
      from public.print_stations ps
      where ps.id = sid
        and ps.restaurant_id = new.restaurant_id
    ) into ok;
    if not ok then
      raise exception 'print_station_ids must reference print_stations for the same restaurant';
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists menu_items_print_station_ids_restaurant on public.menu_items;
create trigger menu_items_print_station_ids_restaurant
  before insert or update of print_station_ids, restaurant_id
  on public.menu_items
  for each row
  execute function public.enforce_menu_item_print_station_ids_same_restaurant();

-- When a station is deleted, strip it from dish arrays (categories still SET NULL via FK).
create or replace function public.strip_deleted_print_station_from_menu_items()
returns trigger
language plpgsql
as $$
begin
  update public.menu_items
  set print_station_ids = array_remove(print_station_ids, old.id)
  where restaurant_id = old.restaurant_id
    and old.id = any (print_station_ids);
  return old;
end;
$$;

drop trigger if exists print_stations_strip_menu_item_ids on public.print_stations;
create trigger print_stations_strip_menu_item_ids
  before delete on public.print_stations
  for each row
  execute function public.strip_deleted_print_station_from_menu_items();
