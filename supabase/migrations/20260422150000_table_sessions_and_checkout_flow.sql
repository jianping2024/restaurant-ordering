-- ============================================================
-- Table sessions + checkout lifecycle
-- ============================================================

create table if not exists public.table_sessions (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  table_number integer not null,
  status text not null default 'open' check (status in ('open', 'billing', 'closed')),
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);

create index if not exists idx_table_sessions_restaurant_table
  on public.table_sessions(restaurant_id, table_number);

create index if not exists idx_table_sessions_status
  on public.table_sessions(restaurant_id, status);

-- One active session (open/billing) per table
create unique index if not exists uniq_active_table_session
  on public.table_sessions(restaurant_id, table_number)
  where status in ('open', 'billing');

alter table public.orders
  add column if not exists session_id uuid references public.table_sessions(id) on delete set null;

create index if not exists idx_orders_session
  on public.orders(session_id);

alter table public.bill_splits
  add column if not exists session_id uuid references public.table_sessions(id) on delete set null;

create index if not exists idx_bill_splits_session
  on public.bill_splits(session_id);

-- Extend bill status lifecycle
alter table public.bill_splits
  drop constraint if exists bill_splits_status_check;

alter table public.bill_splits
  add constraint bill_splits_status_check
  check (status in ('pending', 'confirmed', 'requested', 'paid'));

-- RLS for table_sessions (kept permissive to match current public ordering flow)
alter table public.table_sessions enable row level security;

drop policy if exists "table_sessions_public_all" on public.table_sessions;
create policy "table_sessions_public_all"
  on public.table_sessions for all
  using (true)
  with check (true);
