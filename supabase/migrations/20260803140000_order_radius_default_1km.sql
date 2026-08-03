-- Default order fence: 1 km (coarse anti-remote), not 50 m doorway precision.
-- Does not rewrite existing restaurants.order_radius_meters values.
alter table public.restaurants
  alter column order_radius_meters set default 1000;
