-- ============================================================
-- Restaurant tables model: table_id + display_name
-- Data-preserving: backfill from table_number / table_numbers.
-- Dev-only full wipe: scripts/dev-wipe-order-data.sql (never in migrations)
-- ============================================================

create extension if not exists pgcrypto;

-- 1. restaurant_tables
create table if not exists public.restaurant_tables (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  display_name text not null,
  sort_order integer not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint restaurant_tables_display_name_len check (
    char_length(display_name) >= 1 and char_length(display_name) <= 16
  )
);

create unique index if not exists restaurant_tables_active_display_name_unique
  on public.restaurant_tables (restaurant_id, display_name)
  where deleted_at is null;

create index if not exists idx_restaurant_tables_restaurant_active
  on public.restaurant_tables (restaurant_id, sort_order)
  where deleted_at is null;

-- Seed from restaurants.table_numbers (preserve configured labels)
insert into public.restaurant_tables (restaurant_id, display_name, sort_order)
select r.id, tn.label, tn.ord::integer
from public.restaurants r
cross join lateral unnest(r.table_numbers) with ordinality as tn(label, ord)
where not exists (
  select 1
  from public.restaurant_tables rt
  where rt.restaurant_id = r.id
    and rt.display_name = tn.label
    and rt.deleted_at is null
);

-- Historical labels missing from table_numbers (orders / sessions / splits)
with orphan_labels as (
  select distinct restaurant_id, table_number as display_name
  from (
    select restaurant_id, table_number from public.table_sessions
    union
    select restaurant_id, table_number from public.orders
    union
    select restaurant_id, table_number from public.bill_splits
  ) src
  where table_number is not null
    and btrim(table_number) <> ''
),
numbered_orphans as (
  select
    o.restaurant_id,
    o.display_name,
    coalesce((
      select max(rt.sort_order)
      from public.restaurant_tables rt
      where rt.restaurant_id = o.restaurant_id
    ), 0) + row_number() over (
      partition by o.restaurant_id
      order by o.display_name
    ) as sort_order
  from orphan_labels o
  where not exists (
    select 1
    from public.restaurant_tables rt
    where rt.restaurant_id = o.restaurant_id
      and rt.display_name = o.display_name
      and rt.deleted_at is null
  )
)
insert into public.restaurant_tables (restaurant_id, display_name, sort_order)
select restaurant_id, display_name, sort_order
from numbered_orphans;

-- Default A-01 … A-10 when a restaurant has no table rows yet
insert into public.restaurant_tables (restaurant_id, display_name, sort_order)
select r.id, 'A-' || lpad(i::text, 2, '0'), i
from public.restaurants r
cross join generate_series(1, 10) as i
where not exists (
  select 1 from public.restaurant_tables rt where rt.restaurant_id = r.id
);

-- 2. Drop old session / order indexes on table_number
drop index if exists public.uniq_active_table_session;
drop index if exists public.idx_table_sessions_restaurant_table;
drop index if exists public.idx_orders_table;

-- 3. table_sessions: table_id replaces table_number
alter table public.table_sessions
  add column if not exists table_id uuid references public.restaurant_tables(id) on delete restrict;

update public.table_sessions ts
set table_id = rt.id
from public.restaurant_tables rt
where ts.table_id is null
  and ts.restaurant_id = rt.restaurant_id
  and ts.table_number = rt.display_name
  and rt.deleted_at is null;

do $$
begin
  if exists (
    select 1
    from public.table_sessions ts
    where ts.table_id is null
      and ts.table_number is not null
      and btrim(ts.table_number) <> ''
  ) then
    raise exception 'table_sessions backfill incomplete: orphan table_number values remain';
  end if;
end;
$$;

alter table public.table_sessions
  drop column if exists table_number;

alter table public.table_sessions
  alter column table_id set not null;

create unique index if not exists uniq_active_table_session
  on public.table_sessions (restaurant_id, table_id)
  where status in ('open', 'billing');

create index if not exists idx_table_sessions_restaurant_table_id
  on public.table_sessions (restaurant_id, table_id);

-- 4. orders
alter table public.orders
  add column if not exists table_id uuid references public.restaurant_tables(id) on delete restrict;

alter table public.orders
  add column if not exists display_name text;

update public.orders o
set
  table_id = rt.id,
  display_name = coalesce(o.display_name, rt.display_name)
from public.restaurant_tables rt
where o.table_id is null
  and o.restaurant_id = rt.restaurant_id
  and o.table_number = rt.display_name
  and rt.deleted_at is null;

do $$
begin
  if exists (
    select 1
    from public.orders o
    where o.table_id is null
      and o.table_number is not null
      and btrim(o.table_number) <> ''
  ) then
    raise exception 'orders backfill incomplete: orphan table_number values remain';
  end if;
end;
$$;

alter table public.orders
  drop column if exists table_number;

alter table public.orders
  alter column table_id set not null;

alter table public.orders
  alter column display_name set not null;

create index if not exists idx_orders_restaurant_table_id
  on public.orders (restaurant_id, table_id);

-- 5. bill_splits
alter table public.bill_splits
  add column if not exists table_id uuid references public.restaurant_tables(id) on delete restrict;

alter table public.bill_splits
  add column if not exists display_name text;

update public.bill_splits bs
set
  table_id = rt.id,
  display_name = coalesce(bs.display_name, rt.display_name)
from public.restaurant_tables rt
where bs.table_id is null
  and bs.restaurant_id = rt.restaurant_id
  and bs.table_number = rt.display_name
  and rt.deleted_at is null;

do $$
begin
  if exists (
    select 1
    from public.bill_splits bs
    where bs.table_id is null
      and bs.table_number is not null
      and btrim(bs.table_number) <> ''
  ) then
    raise exception 'bill_splits backfill incomplete: orphan table_number values remain';
  end if;
end;
$$;

alter table public.bill_splits
  drop column if exists table_number;

alter table public.bill_splits
  alter column table_id set not null;

alter table public.bill_splits
  alter column display_name set not null;

-- 6. restaurants: drop table_numbers array
drop view if exists public.restaurants_public;

alter table public.restaurants
  drop constraint if exists restaurants_table_numbers_cardinality_check;

alter table public.restaurants
  drop column if exists table_numbers;

create view public.restaurants_public
with (security_invoker = false) as
  select
    id,
    name,
    slug,
    logo_url,
    address,
    phone,
    plan,
    geo_latitude,
    geo_longitude,
    print_locale,
    created_at,
    order_radius_meters
  from public.restaurants;

grant select on public.restaurants_public to anon, authenticated;

-- 7. print_jobs: backfill payload, then generated columns (table_id + display_name)
update public.print_jobs pj
set payload = pj.payload
  || jsonb_strip_nulls(jsonb_build_object(
    'display_name', coalesce(
      nullif(btrim(pj.payload->>'display_name'), ''),
      case jsonb_typeof(pj.payload->'table_number')
        when 'number' then trim((pj.payload->'table_number')::text)
        when 'string' then nullif(btrim(pj.payload->>'table_number'), '')
        else null
      end
    ),
    'table_id', rt.id::text
  ))
from public.restaurant_tables rt
where pj.restaurant_id = rt.restaurant_id
  and rt.deleted_at is null
  and (
    not (pj.payload ? 'table_id')
    or nullif(btrim(pj.payload->>'table_id'), '') is null
  )
  and rt.display_name = case jsonb_typeof(pj.payload->'table_number')
    when 'number' then trim((pj.payload->'table_number')::text)
    when 'string' then nullif(btrim(pj.payload->>'table_number'), '')
    else null
  end;

alter table public.print_jobs drop column if exists table_number;

alter table public.print_jobs
  add column if not exists table_display text
  generated always as (
    nullif(btrim(payload->>'display_name'), '')
  ) stored;

alter table public.print_jobs
  add column if not exists table_id uuid
  generated always as (
    case
      when payload ? 'table_id'
        and (payload->>'table_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then (payload->>'table_id')::uuid
      else null
    end
  ) stored;

create index if not exists idx_print_jobs_restaurant_table_id
  on public.print_jobs (restaurant_id, table_id, created_at desc)
  where table_id is not null;

-- 9. Drop legacy RPCs
drop function if exists public.rename_restaurant_table_number(uuid, text, text);
drop function if exists public.rename_restaurant_table_number(uuid, integer, integer);
drop function if exists public.merge_multiple_table_sessions(uuid, text[], text);
drop function if exists public.merge_multiple_table_sessions(uuid, integer[], integer);
drop function if exists public.transfer_table_session(uuid, text, text);
drop function if exists public.transfer_table_session(uuid, integer, integer);
drop function if exists public.merge_table_sessions(uuid, text, text);
drop function if exists public.merge_table_sessions(uuid, integer, integer);

-- Helper: resolve active table row
create or replace function public.get_active_restaurant_table(
  p_restaurant_id uuid,
  p_table_id uuid
)
returns public.restaurant_tables
language sql
stable
security definer
set search_path = public
as $$
  select rt.*
  from public.restaurant_tables rt
  where rt.restaurant_id = p_restaurant_id
    and rt.id = p_table_id
    and rt.deleted_at is null
  limit 1;
$$;

revoke all on function public.get_active_restaurant_table(uuid, uuid) from public;
grant execute on function public.get_active_restaurant_table(uuid, uuid) to authenticated;

-- 10. transfer_table_session (UUID)
create or replace function public.transfer_table_session(
  p_restaurant_id uuid,
  p_from_table_id uuid,
  p_to_table_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source_session public.table_sessions%rowtype;
  v_target_session_id uuid;
  v_target_display text;
begin
  if p_from_table_id = p_to_table_id then
    raise exception 'source and target table cannot be the same';
  end if;

  select display_name into v_target_display
  from public.get_active_restaurant_table(p_restaurant_id, p_to_table_id);
  if v_target_display is null then
    raise exception 'invalid target table';
  end if;

  if not exists (
    select 1 from public.get_active_restaurant_table(p_restaurant_id, p_from_table_id)
  ) then
    raise exception 'invalid source table';
  end if;

  select *
  into v_source_session
  from public.table_sessions
  where restaurant_id = p_restaurant_id
    and table_id = p_from_table_id
    and status in ('open', 'billing')
  order by opened_at desc
  limit 1
  for update;

  if not found then
    raise exception 'source table has no active session';
  end if;

  select id
  into v_target_session_id
  from public.table_sessions
  where restaurant_id = p_restaurant_id
    and table_id = p_to_table_id
    and status in ('open', 'billing')
  order by opened_at desc
  limit 1
  for update;

  if v_target_session_id is not null then
    raise exception 'target table already has active session';
  end if;

  update public.table_sessions
  set table_id = p_to_table_id
  where id = v_source_session.id;

  update public.orders
  set table_id = p_to_table_id,
      display_name = v_target_display,
      session_id = coalesce(session_id, v_source_session.id)
  where restaurant_id = p_restaurant_id
    and table_id = p_from_table_id
    and status in ('pending', 'cooking', 'done')
    and (session_id is null or session_id = v_source_session.id);

  update public.bill_splits
  set table_id = p_to_table_id,
      display_name = v_target_display,
      session_id = coalesce(session_id, v_source_session.id)
  where restaurant_id = p_restaurant_id
    and table_id = p_from_table_id
    and status in ('pending', 'confirmed', 'requested')
    and (session_id is null or session_id = v_source_session.id);

  return v_source_session.id;
end;
$$;

-- 11. merge_table_sessions (UUID)
create or replace function public.merge_table_sessions(
  p_restaurant_id uuid,
  p_source_table_id uuid,
  p_target_table_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source_session public.table_sessions%rowtype;
  v_target_session public.table_sessions%rowtype;
  v_source_split public.bill_splits%rowtype;
  v_target_split public.bill_splits%rowtype;
  v_target_display text;
begin
  if p_source_table_id = p_target_table_id then
    raise exception 'source and target table cannot be the same';
  end if;

  select display_name into v_target_display
  from public.get_active_restaurant_table(p_restaurant_id, p_target_table_id);
  if v_target_display is null then
    raise exception 'invalid target table';
  end if;

  select *
  into v_source_session
  from public.table_sessions
  where restaurant_id = p_restaurant_id
    and table_id = p_source_table_id
    and status in ('open', 'billing')
  order by opened_at desc
  limit 1
  for update;

  if not found then
    raise exception 'source table has no active session';
  end if;

  select *
  into v_target_session
  from public.table_sessions
  where restaurant_id = p_restaurant_id
    and table_id = p_target_table_id
    and status in ('open', 'billing')
  order by opened_at desc
  limit 1
  for update;

  if not found then
    raise exception 'target table has no active session';
  end if;

  update public.bill_splits
  set session_id = v_source_session.id
  where restaurant_id = p_restaurant_id
    and table_id = p_source_table_id
    and status in ('pending', 'confirmed', 'requested')
    and session_id is null;

  update public.bill_splits
  set session_id = v_target_session.id
  where restaurant_id = p_restaurant_id
    and table_id = p_target_table_id
    and status in ('pending', 'confirmed', 'requested')
    and session_id is null;

  update public.orders
  set session_id = v_target_session.id,
      table_id = p_target_table_id,
      display_name = v_target_display
  where restaurant_id = p_restaurant_id
    and table_id = p_source_table_id
    and status in ('pending', 'cooking', 'done')
    and (session_id is null or session_id = v_source_session.id);

  select *
  into v_source_split
  from public.bill_splits
  where session_id = v_source_session.id
    and status in ('pending', 'confirmed', 'requested')
  order by created_at desc
  limit 1
  for update;

  select *
  into v_target_split
  from public.bill_splits
  where session_id = v_target_session.id
    and status in ('pending', 'confirmed', 'requested')
  order by created_at desc
  limit 1
  for update;

  if v_source_split.id is not null and v_target_split.id is not null then
    update public.bill_splits
    set order_ids = (
          select array_agg(distinct x)
          from unnest(coalesce(v_target_split.order_ids, '{}'::uuid[]) || coalesce(v_source_split.order_ids, '{}'::uuid[])) as x
        ),
        persons = coalesce(v_target_split.persons, '[]'::jsonb) || coalesce(v_source_split.persons, '[]'::jsonb),
        result = coalesce(v_target_split.result, '[]'::jsonb) || coalesce(v_source_split.result, '[]'::jsonb),
        total_amount = coalesce(v_target_split.total_amount, 0) + coalesce(v_source_split.total_amount, 0)
    where id = v_target_split.id;

    delete from public.bill_splits
    where id = v_source_split.id;
  elsif v_source_split.id is not null then
    update public.bill_splits
    set session_id = v_target_session.id,
        table_id = p_target_table_id,
        display_name = v_target_display
    where id = v_source_split.id;
  end if;

  update public.bill_splits
  set session_id = v_target_session.id,
      table_id = p_target_table_id,
      display_name = v_target_display
  where session_id = v_source_session.id
    and status in ('pending', 'confirmed', 'requested');

  update public.table_sessions
  set status = 'closed',
      closed_at = now(),
      closed_reason = 'merged',
      merge_into_session_id = v_target_session.id
  where id = v_source_session.id;

  return v_target_session.id;
end;
$$;

create or replace function public.merge_multiple_table_sessions(
  p_restaurant_id uuid,
  p_source_table_ids uuid[],
  p_target_table_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source_id uuid;
  v_target_session_id uuid;
begin
  if p_source_table_ids is null or array_length(p_source_table_ids, 1) is null then
    raise exception 'source tables cannot be empty';
  end if;

  if p_target_table_id = any(p_source_table_ids) then
    raise exception 'target cannot be among sources';
  end if;

  foreach v_source_id in array p_source_table_ids loop
    v_target_session_id := public.merge_table_sessions(
      p_restaurant_id,
      v_source_id,
      p_target_table_id
    );
  end loop;

  return v_target_session_id;
end;
$$;

grant execute on function public.transfer_table_session(uuid, uuid, uuid) to authenticated;
grant execute on function public.merge_table_sessions(uuid, uuid, uuid) to authenticated;
grant execute on function public.merge_multiple_table_sessions(uuid, uuid[], uuid) to authenticated;

revoke execute on function public.transfer_table_session(uuid, uuid, uuid) from anon;
revoke execute on function public.merge_table_sessions(uuid, uuid, uuid) from anon;
revoke execute on function public.merge_multiple_table_sessions(uuid, uuid[], uuid) from anon;

-- 12. Seed default tables on new restaurant
create or replace function public.seed_default_restaurant_tables_for_restaurant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.restaurant_tables (restaurant_id, display_name, sort_order)
  select new.id, 'A-' || lpad(i::text, 2, '0'), i
  from generate_series(1, 10) as i
  where not exists (
    select 1 from public.restaurant_tables rt where rt.restaurant_id = new.id
  );
  return new;
end;
$$;

drop trigger if exists restaurants_after_insert_seed_restaurant_tables on public.restaurants;
create trigger restaurants_after_insert_seed_restaurant_tables
  after insert on public.restaurants
  for each row
  execute function public.seed_default_restaurant_tables_for_restaurant();

-- 13. RLS restaurant_tables
alter table public.restaurant_tables enable row level security;

drop policy if exists restaurant_tables_public_read on public.restaurant_tables;
create policy restaurant_tables_public_read
  on public.restaurant_tables for select
  using (deleted_at is null);

drop policy if exists restaurant_tables_owner_all on public.restaurant_tables;
create policy restaurant_tables_owner_all
  on public.restaurant_tables for all
  using (
    restaurant_id in (
      select id from public.restaurants where owner_id = auth.uid()
    )
  );

drop policy if exists restaurant_tables_staff_select on public.restaurant_tables;
create policy restaurant_tables_staff_select
  on public.restaurant_tables for select
  to authenticated
  using (
    deleted_at is null
    and public.is_active_restaurant_staff(
      restaurant_id,
      array['kitchen', 'waiter', 'cashier']::text[]
    )
  );

grant select on public.restaurant_tables to anon, authenticated;
