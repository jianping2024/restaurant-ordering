-- Waiter buffet block: postgres_changes so resolve_buffet_prices stays fresh when owners edit pricing.
-- replica identity FULL: filters on restaurant_id for UPDATE/DELETE.

alter table public.buffets replica identity full;
alter table public.buffet_time_slots replica identity full;
alter table public.buffet_price_rules replica identity full;
alter table public.buffet_calendar_overrides replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'buffets'
  ) then
    alter publication supabase_realtime add table public.buffets;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'buffet_time_slots'
  ) then
    alter publication supabase_realtime add table public.buffet_time_slots;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'buffet_price_rules'
  ) then
    alter publication supabase_realtime add table public.buffet_price_rules;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'buffet_calendar_overrides'
  ) then
    alter publication supabase_realtime add table public.buffet_calendar_overrides;
  end if;
end $$;
