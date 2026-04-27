-- ============================================================
-- Post-checkout dish feedback
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.feedback_sessions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  session_id uuid not null references public.table_sessions(id) on delete cascade,
  source text not null default 'bill_success',
  shown_at timestamptz not null default now(),
  completed_at timestamptz,
  skipped_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists uniq_feedback_session
  on public.feedback_sessions(session_id);

create index if not exists idx_feedback_sessions_restaurant_created
  on public.feedback_sessions(restaurant_id, created_at desc);

create table if not exists public.dish_feedback (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  session_id uuid not null references public.table_sessions(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  menu_item_id uuid not null references public.menu_items(id) on delete cascade,
  vote text not null check (vote in ('up', 'down')),
  reasons text[] not null default '{}',
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uniq_dish_feedback_session_item
  on public.dish_feedback(session_id, menu_item_id);

create index if not exists idx_dish_feedback_restaurant_created
  on public.dish_feedback(restaurant_id, created_at desc);

create index if not exists idx_dish_feedback_vote
  on public.dish_feedback(restaurant_id, vote);

drop trigger if exists dish_feedback_updated_at on public.dish_feedback;
create trigger dish_feedback_updated_at
  before update on public.dish_feedback
  for each row execute function public.handle_updated_at();

alter table public.feedback_sessions enable row level security;
drop policy if exists "feedback_sessions_public_all" on public.feedback_sessions;
create policy "feedback_sessions_public_all"
  on public.feedback_sessions for all
  using (true)
  with check (true);

alter table public.dish_feedback enable row level security;
drop policy if exists "dish_feedback_public_all" on public.dish_feedback;
create policy "dish_feedback_public_all"
  on public.dish_feedback for all
  using (true)
  with check (true);
