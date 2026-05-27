alter table public.restaurants
  add column if not exists order_radius_meters integer not null default 50;

alter table public.restaurants
  drop constraint if exists restaurants_order_radius_meters_check;

alter table public.restaurants
  add constraint restaurants_order_radius_meters_check
  check (order_radius_meters >= 10 and order_radius_meters <= 10000);

-- CREATE OR REPLACE cannot insert columns before existing view columns; drop and recreate.
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
    order_radius_meters
  from public.restaurants;

grant select on public.restaurants_public to anon, authenticated;
