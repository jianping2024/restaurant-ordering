alter table public.restaurants
  add column if not exists geo_latitude double precision,
  add column if not exists geo_longitude double precision;
