-- New restaurants get the same two default print stations as backfilled stores (kitchen + bar).

create or replace function public.seed_default_print_stations_for_restaurant()
returns trigger
language plpgsql as $$
begin
  insert into public.print_stations (restaurant_id, name_pt, name_en, name_zh, sort_order, ticket_layout)
  select new.id, 'Cozinha', 'Kitchen', '后厨', 0, 'kitchen'
  where not exists (
    select 1 from public.print_stations ps where ps.restaurant_id = new.id and ps.ticket_layout = 'kitchen'
  );
  insert into public.print_stations (restaurant_id, name_pt, name_en, name_zh, sort_order, ticket_layout)
  select new.id, 'Bar', 'Bar', '吧台', 1, 'beverage'
  where not exists (
    select 1 from public.print_stations ps where ps.restaurant_id = new.id and ps.ticket_layout = 'beverage'
  );
  return new;
end;
$$;

drop trigger if exists restaurants_after_insert_seed_print_stations on public.restaurants;
create trigger restaurants_after_insert_seed_print_stations
  after insert on public.restaurants
  for each row
  execute function public.seed_default_print_stations_for_restaurant();
