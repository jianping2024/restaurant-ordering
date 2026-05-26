-- Realtime: dashboard checkout listens to bill_splits (restaurant_id filter).
-- replica identity FULL: required for UPDATE/DELETE with non-PK filters (same as orders).

alter table public.bill_splits replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'bill_splits'
  ) then
    alter publication supabase_realtime add table public.bill_splits;
  end if;
end $$;
