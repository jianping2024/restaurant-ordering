-- print_jobs: thermal queue consumed by print agent; station_ticket from waiter/kitchen APIs.
-- restaurants.print_locale: single ticket language (pt = pt-PT semantics).

alter table public.restaurants
  add column if not exists print_locale text not null default 'pt'
    check (print_locale in ('zh', 'en', 'pt'));

create table if not exists public.print_jobs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  type text not null
    check (type in ('order_receipt', 'station_ticket', 'pre_bill')),
  payload jsonb not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'done', 'failed')),
  claimed_by text,
  attempts integer not null default 0,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_print_jobs_restaurant_status_created
  on public.print_jobs (restaurant_id, status, created_at desc);

alter table public.print_jobs replica identity full;

alter table public.print_jobs enable row level security;

drop policy if exists "print_jobs_owner_select" on public.print_jobs;
create policy "print_jobs_owner_select"
  on public.print_jobs for select
  using (
    restaurant_id in (
      select id from public.restaurants where owner_id = auth.uid()
    )
  );

drop policy if exists "print_jobs_owner_insert" on public.print_jobs;
create policy "print_jobs_owner_insert"
  on public.print_jobs for insert
  with check (
    restaurant_id in (
      select id from public.restaurants where owner_id = auth.uid()
    )
  );

drop policy if exists "print_jobs_owner_update" on public.print_jobs;
create policy "print_jobs_owner_update"
  on public.print_jobs for update
  using (
    restaurant_id in (
      select id from public.restaurants where owner_id = auth.uid()
    )
  );

drop policy if exists "print_jobs_owner_delete" on public.print_jobs;
create policy "print_jobs_owner_delete"
  on public.print_jobs for delete
  using (
    restaurant_id in (
      select id from public.restaurants where owner_id = auth.uid()
    )
  );

drop trigger if exists print_jobs_set_updated_at on public.print_jobs;
create trigger print_jobs_set_updated_at
  before update on public.print_jobs
  for each row
  execute function public.handle_updated_at();

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'print_jobs'
  ) then
    alter publication supabase_realtime add table public.print_jobs;
  end if;
end $$;
