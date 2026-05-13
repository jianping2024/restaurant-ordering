-- ============================================================
-- Buffet (per-head) pricing: definitions, time slots, rules, calendar
-- Single-restaurant rows scoped by restaurant_id (chain-ready).
-- ============================================================

create table if not exists public.buffets (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_buffets_restaurant on public.buffets(restaurant_id);

create table if not exists public.buffet_time_slots (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  start_time time not null,
  end_time time not null,
  -- 0=Sunday .. 6=Saturday (PostgreSQL EXTRACT(DOW))
  weekdays int[] not null default array[0, 1, 2, 3, 4, 5, 6]::int[],
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_buffet_time_slots_restaurant on public.buffet_time_slots(restaurant_id);

create table if not exists public.buffet_price_rules (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  buffet_id uuid not null references public.buffets(id) on delete cascade,
  time_slot_id uuid not null references public.buffet_time_slots(id) on delete cascade,
  calendar_kind text not null check (calendar_kind in ('weekday', 'weekend', 'holiday', 'special')),
  valid_from date not null,
  valid_to date not null,
  adult_price numeric(10, 2) not null,
  child_price numeric(10, 2) not null,
  priority integer not null default 0,
  is_active boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  constraint buffet_price_rules_valid_range check (valid_to >= valid_from)
);

create index if not exists idx_buffet_price_rules_lookup
  on public.buffet_price_rules(restaurant_id, buffet_id, time_slot_id, calendar_kind)
  where is_active = true;

create table if not exists public.buffet_calendar_overrides (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  on_date date not null,
  kind text not null check (kind in ('holiday', 'special')),
  primary key (restaurant_id, on_date)
);

-- updated_at on buffets
drop trigger if exists buffets_updated_at on public.buffets;
create trigger buffets_updated_at
  before update on public.buffets
  for each row execute function public.handle_updated_at();

-- RLS (align with menu_items: public read, owner write)
alter table public.buffets enable row level security;
alter table public.buffet_time_slots enable row level security;
alter table public.buffet_price_rules enable row level security;
alter table public.buffet_calendar_overrides enable row level security;

create policy "buffets_public_read"
  on public.buffets for select using (true);

create policy "buffets_owner_insert"
  on public.buffets for insert
  with check (
    restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
  );

create policy "buffets_owner_update"
  on public.buffets for update
  using (
    restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
  );

create policy "buffets_owner_delete"
  on public.buffets for delete
  using (
    restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
  );

create policy "buffet_time_slots_public_read"
  on public.buffet_time_slots for select using (true);

create policy "buffet_time_slots_owner_insert"
  on public.buffet_time_slots for insert
  with check (
    restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
  );

create policy "buffet_time_slots_owner_update"
  on public.buffet_time_slots for update
  using (
    restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
  );

create policy "buffet_time_slots_owner_delete"
  on public.buffet_time_slots for delete
  using (
    restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
  );

create policy "buffet_price_rules_public_read"
  on public.buffet_price_rules for select using (true);

create policy "buffet_price_rules_owner_insert"
  on public.buffet_price_rules for insert
  with check (
    restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
  );

create policy "buffet_price_rules_owner_update"
  on public.buffet_price_rules for update
  using (
    restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
  );

create policy "buffet_price_rules_owner_delete"
  on public.buffet_price_rules for delete
  using (
    restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
  );

create policy "buffet_calendar_public_read"
  on public.buffet_calendar_overrides for select using (true);

create policy "buffet_calendar_owner_insert"
  on public.buffet_calendar_overrides for insert
  with check (
    restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
  );

create policy "buffet_calendar_owner_update"
  on public.buffet_calendar_overrides for update
  using (
    restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
  );

create policy "buffet_calendar_owner_delete"
  on public.buffet_calendar_overrides for delete
  using (
    restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
  );

-- Resolve adult/child unit prices for a buffet at a point in time (UTC date/time).
create or replace function public.resolve_buffet_prices(
  p_restaurant_id uuid,
  p_buffet_id uuid,
  p_at timestamptz default now()
)
returns table (
  adult_price numeric,
  child_price numeric,
  rule_id uuid,
  time_slot_id uuid
)
language plpgsql
stable
as $$
declare
  v_date date;
  v_t time;
  v_dow int;
  v_override text;
  v_cal text;
  v_slot_id uuid;
begin
  v_date := (p_at at time zone 'utc')::date;
  v_t := (p_at at time zone 'utc')::time;
  v_dow := extract(dow from (p_at at time zone 'utc'))::int;

  select bco.kind into v_override
  from public.buffet_calendar_overrides bco
  where bco.restaurant_id = p_restaurant_id
    and bco.on_date = v_date;

  if v_override = 'holiday' then
    v_cal := 'holiday';
  elsif v_override = 'special' then
    v_cal := 'special';
  elsif v_dow in (0, 6) then
    v_cal := 'weekend';
  else
    v_cal := 'weekday';
  end if;

  select ts.id into v_slot_id
  from public.buffet_time_slots ts
  where ts.restaurant_id = p_restaurant_id
    and v_dow = any (ts.weekdays)
    and (
      (ts.start_time <= ts.end_time and v_t >= ts.start_time and v_t < ts.end_time)
      or (ts.start_time > ts.end_time and (v_t >= ts.start_time or v_t < ts.end_time))
    )
  order by ts.sort_order asc, ts.name asc
  limit 1;

  if v_slot_id is null then
    return query select null::numeric, null::numeric, null::uuid, null::uuid;
    return;
  end if;

  return query
  select r.adult_price, r.child_price, r.id, r.time_slot_id
  from public.buffet_price_rules r
  where r.restaurant_id = p_restaurant_id
    and r.buffet_id = p_buffet_id
    and r.time_slot_id = v_slot_id
    and r.calendar_kind = v_cal
    and r.is_active
    and v_date between r.valid_from and r.valid_to
  order by r.priority desc, r.valid_from desc
  limit 1;
end;
$$;

grant execute on function public.resolve_buffet_prices(uuid, uuid, timestamptz) to anon, authenticated;
