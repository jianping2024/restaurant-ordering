-- Default order fence: 500 m (high-accuracy browser geo for anchor + guest checks).
-- Does not rewrite existing restaurants.order_radius_meters values.
alter table public.restaurants
  alter column order_radius_meters set default 500;
