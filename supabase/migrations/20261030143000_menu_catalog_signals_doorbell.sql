-- Narrow guest doorbell for menu catalog freshness (same pattern as table_checkout_signals).
-- Listening on public.restaurants CDC did not deliver UPDATE events to anon clients reliably;
-- this table only carries restaurant_id + version (no secrets).

create table if not exists public.menu_catalog_signals (
  restaurant_id uuid primary key references public.restaurants (id) on delete cascade,
  version integer not null,
  bumped_at timestamptz not null default now()
);

comment on table public.menu_catalog_signals is
  'Guest Realtime doorbell: mirrors restaurants.menu_catalog_version after dashboard menu writes.';

alter table public.menu_catalog_signals replica identity full;

alter table public.menu_catalog_signals enable row level security;

drop policy if exists menu_catalog_signals_select_public on public.menu_catalog_signals;
create policy menu_catalog_signals_select_public
  on public.menu_catalog_signals
  for select
  to anon, authenticated
  using (true);

-- service_role / admin writes only (no anon insert/update policies)

insert into public.menu_catalog_signals (restaurant_id, version, bumped_at)
select id, menu_catalog_version, now()
from public.restaurants
on conflict (restaurant_id) do update
set version = excluded.version,
    bumped_at = excluded.bumped_at;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'menu_catalog_signals'
    ) then
      alter publication supabase_realtime add table public.menu_catalog_signals;
    end if;
    -- Drop broad restaurants CDC if we added it for this doorbell experiment.
    if exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'restaurants'
    ) then
      alter publication supabase_realtime drop table public.restaurants;
    end if;
  end if;
end $$;
