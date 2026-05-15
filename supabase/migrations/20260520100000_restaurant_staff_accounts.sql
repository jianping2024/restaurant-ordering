-- Staff accounts (Supabase Auth + per-restaurant login_name)

create table public.restaurant_staff_accounts (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  role text not null check (role in ('kitchen', 'waiter')),
  display_name text not null,
  login_name text not null,
  email text not null unique,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  disabled_at timestamptz,
  unique (restaurant_id, login_name)
);

create index restaurant_staff_accounts_restaurant_id_idx
  on public.restaurant_staff_accounts (restaurant_id);

create index restaurant_staff_accounts_user_id_idx
  on public.restaurant_staff_accounts (user_id);

alter table public.restaurant_staff_accounts enable row level security;

-- Owner: full access to own restaurant's staff rows
create policy restaurant_staff_accounts_owner_all
  on public.restaurant_staff_accounts
  for all
  to authenticated
  using (
    restaurant_id in (
      select id from public.restaurants where owner_id = auth.uid()
    )
  )
  with check (
    restaurant_id in (
      select id from public.restaurants where owner_id = auth.uid()
    )
  );

-- Staff: read own active row (login/session checks)
create policy restaurant_staff_accounts_staff_select_own
  on public.restaurant_staff_accounts
  for select
  to authenticated
  using (user_id = auth.uid() and disabled_at is null);

create or replace function public.is_active_restaurant_staff(
  p_restaurant_id uuid,
  p_roles text[] default array['kitchen', 'waiter']
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.restaurant_staff_accounts a
    where a.user_id = auth.uid()
      and a.restaurant_id = p_restaurant_id
      and a.disabled_at is null
      and a.role = any(p_roles)
  );
$$;

revoke all on function public.is_active_restaurant_staff(uuid, text[]) from public;
grant execute on function public.is_active_restaurant_staff(uuid, text[]) to authenticated;

-- Orders: staff read/update for their restaurant (kitchen updates items; waiter reads board)
create policy orders_staff_select
  on public.orders
  for select
  to authenticated
  using (public.is_active_restaurant_staff(restaurant_id));

create policy orders_staff_update
  on public.orders
  for update
  to authenticated
  using (public.is_active_restaurant_staff(restaurant_id, array['kitchen', 'waiter']))
  with check (public.is_active_restaurant_staff(restaurant_id, array['kitchen', 'waiter']));

-- Table sessions: staff read active + billing for board
create policy table_sessions_staff_select
  on public.table_sessions
  for select
  to authenticated
  using (public.is_active_restaurant_staff(restaurant_id));
