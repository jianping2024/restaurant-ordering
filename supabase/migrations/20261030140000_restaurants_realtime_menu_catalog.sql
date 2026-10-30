-- Guest menu catalog doorbell: listen for restaurants.menu_catalog_version bumps.
-- Anon already has restaurants SELECT (restaurants_public_read_by_slug using true).
-- Filter on the client: id=eq.<restaurant_id> → ensureCustomerMenuCatalog (knownVersion).

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'restaurants'
    ) then
      alter publication supabase_realtime add table public.restaurants;
    end if;
  end if;
end $$;
