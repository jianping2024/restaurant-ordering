-- In-store takeaway ordering: feature flag fields live in restaurants.feature_flags jsonb.
-- Group mark, menu sales role, session channel, daily revenue split columns.

-- 1) Takeaway table group (at most one per restaurant)
alter table public.restaurant_table_groups
  add column if not exists is_takeaway boolean not null default false;

comment on column public.restaurant_table_groups.is_takeaway is
  'When true and restaurants.feature_flags.takeaway_ordering is on, tables in this group are takeaway desks.';

create unique index if not exists restaurant_table_groups_one_takeaway_per_restaurant
  on public.restaurant_table_groups (restaurant_id)
  where is_takeaway;

-- 2) Menu item sales role + takeaway price
alter table public.menu_items
  add column if not exists takeaway_role text not null default 'none';

alter table public.menu_items
  add column if not exists takeaway_price numeric null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'menu_items_takeaway_role_check'
      and conrelid = 'public.menu_items'::regclass
  ) then
    alter table public.menu_items
      add constraint menu_items_takeaway_role_check
      check (takeaway_role in ('none', 'sellable', 'packaging'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'menu_items_takeaway_price_when_sellable'
      and conrelid = 'public.menu_items'::regclass
  ) then
    alter table public.menu_items
      add constraint menu_items_takeaway_price_when_sellable
      check (
        takeaway_role <> 'sellable'
        or (takeaway_price is not null and takeaway_price > 0)
      );
  end if;
end $$;

comment on column public.menu_items.takeaway_role is
  'none=dine-in only; sellable=also on takeaway menu at takeaway_price; packaging=checkout supply only.';
comment on column public.menu_items.takeaway_price is
  'Unit price when takeaway_role=sellable; ignored otherwise.';

-- 3) Session ordering channel (stamped at open)
alter table public.table_sessions
  add column if not exists ordering_channel text not null default 'dine_in';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'table_sessions_ordering_channel_check'
      and conrelid = 'public.table_sessions'::regclass
  ) then
    alter table public.table_sessions
      add constraint table_sessions_ordering_channel_check
      check (ordering_channel in ('dine_in', 'takeaway'));
  end if;
end $$;

comment on column public.table_sessions.ordering_channel is
  'Stamped at open: dine_in | takeaway. Sole source for menu price, print badge, revenue split after open.';

create index if not exists idx_table_sessions_restaurant_channel_opened
  on public.table_sessions (restaurant_id, ordering_channel, opened_at desc);

-- 4) Daily stats: split collected revenue by channel (same day row)
alter table public.analytics_daily_restaurant_stats
  add column if not exists dine_in_revenue numeric not null default 0;

alter table public.analytics_daily_restaurant_stats
  add column if not exists takeaway_revenue numeric not null default 0;

comment on column public.analytics_daily_restaurant_stats.dine_in_revenue is
  'Portion of revenue from sessions with ordering_channel=dine_in (legacy rows treated as dine_in).';
comment on column public.analytics_daily_restaurant_stats.takeaway_revenue is
  'Portion of revenue from sessions with ordering_channel=takeaway.';
