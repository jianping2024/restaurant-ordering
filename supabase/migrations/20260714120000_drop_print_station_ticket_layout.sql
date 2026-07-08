-- Remove unused print_stations.ticket_layout (never consumed by print-agent).
-- Clean frozen station_ticket payloads in dev; field was never read at print time.

CREATE OR REPLACE FUNCTION public.seed_default_print_stations_for_restaurant() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  insert into public.print_stations (restaurant_id, name_pt, name_en, name_zh, sort_order)
  select new.id, 'Cozinha', 'Kitchen', '后厨', 0
  where not exists (
    select 1 from public.print_stations ps
    where ps.restaurant_id = new.id and ps.name_pt = 'Cozinha'
  );
  insert into public.print_stations (restaurant_id, name_pt, name_en, name_zh, sort_order)
  select new.id, 'Bar', 'Bar', '吧台', 1
  where not exists (
    select 1 from public.print_stations ps
    where ps.restaurant_id = new.id and ps.name_pt = 'Bar'
  );
  return new;
end;
$$;
update public.print_jobs
set payload = payload - 'ticket_layout'
where type = 'station_ticket'
  and payload ? 'ticket_layout';
alter table public.print_stations drop column ticket_layout;
