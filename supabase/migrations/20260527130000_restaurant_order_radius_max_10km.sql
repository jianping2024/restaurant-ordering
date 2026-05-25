alter table public.restaurants
  drop constraint if exists restaurants_order_radius_meters_check;

alter table public.restaurants
  add constraint restaurants_order_radius_meters_check
  check (order_radius_meters >= 10 and order_radius_meters <= 10000);
