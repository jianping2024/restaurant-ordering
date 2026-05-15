-- Public menu / waiter / kitchen entry pages query `restaurants_public` by slug.
-- With security_invoker=true, the caller's RLS applies to the underlying `restaurants` table;
-- after dropping `restaurants_public_read_by_slug`, anon and staff (non-owner) matched zero rows → 404.
-- Use invoker=false so the view reads as its owner (migration role), while still projecting only safe columns.

create or replace view public.restaurants_public
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
    created_at
  from public.restaurants;

grant select on public.restaurants_public to anon, authenticated;
