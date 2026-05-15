-- Pairing codes for Windows print agent; devices after successful claim.

create table if not exists public.print_agent_pairings (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  code text not null check (code ~ '^[0-9]{6}$'),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_print_agent_pairings_restaurant_expires
  on public.print_agent_pairings (restaurant_id, expires_at desc);

create index if not exists idx_print_agent_pairings_claim_lookup
  on public.print_agent_pairings (code)
  where consumed_at is null;

create table if not exists public.print_agent_devices (
  id uuid primary key,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  pairing_id uuid references public.print_agent_pairings(id) on delete set null,
  label text,
  paired_at timestamptz not null default now(),
  valid_until timestamptz not null,
  revoked_at timestamptz,
  last_seen timestamptz
);

create index if not exists idx_print_agent_devices_restaurant
  on public.print_agent_devices (restaurant_id);

alter table public.print_agent_pairings enable row level security;
alter table public.print_agent_devices enable row level security;

drop policy if exists "print_agent_pairings_owner_select" on public.print_agent_pairings;
create policy "print_agent_pairings_owner_select"
  on public.print_agent_pairings for select
  using (
    restaurant_id in (
      select id from public.restaurants where owner_id = auth.uid()
    )
  );

drop policy if exists "print_agent_pairings_owner_insert" on public.print_agent_pairings;
create policy "print_agent_pairings_owner_insert"
  on public.print_agent_pairings for insert
  with check (
    restaurant_id in (
      select id from public.restaurants where owner_id = auth.uid()
    )
  );

drop policy if exists "print_agent_pairings_owner_update" on public.print_agent_pairings;
create policy "print_agent_pairings_owner_update"
  on public.print_agent_pairings for update
  using (
    restaurant_id in (
      select id from public.restaurants where owner_id = auth.uid()
    )
  );

drop policy if exists "print_agent_devices_owner_select" on public.print_agent_devices;
create policy "print_agent_devices_owner_select"
  on public.print_agent_devices for select
  using (
    restaurant_id in (
      select id from public.restaurants where owner_id = auth.uid()
    )
  );
