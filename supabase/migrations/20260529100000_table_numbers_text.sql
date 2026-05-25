-- Table numbers as alphanumeric labels (e.g. A1, B12, VIP-1).
-- PostgreSQL rejects subqueries in ALTER COLUMN … USING; convert via UPDATE instead.

drop view if exists public.restaurants_public;

alter table public.restaurants
  add column if not exists table_numbers_text text[];

update public.restaurants
set table_numbers_text = coalesce(
  (
    select array_agg(elem::text order by ord)
    from unnest(table_numbers) with ordinality as t(elem, ord)
  ),
  array['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']::text[]
);

alter table public.restaurants
  alter column table_numbers drop default;

alter table public.restaurants
  alter column table_numbers drop not null;

alter table public.restaurants
  drop constraint if exists restaurants_table_numbers_cardinality_check;

alter table public.restaurants
  drop column table_numbers;

alter table public.restaurants
  rename column table_numbers_text to table_numbers;

alter table public.restaurants
  alter column table_numbers set default array['1','2','3','4','5','6','7','8','9','10']::text[];

alter table public.restaurants
  alter column table_numbers set not null;

alter table public.restaurants
  add constraint restaurants_table_numbers_cardinality_check
  check (
    cardinality(table_numbers) >= 1
    and cardinality(table_numbers) <= 200
  );

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
    order_radius_meters,
    table_numbers
  from public.restaurants;

grant select on public.restaurants_public to anon, authenticated;

alter table public.table_sessions
  alter column table_number type text using table_number::text;

alter table public.orders
  alter column table_number type text using table_number::text;

alter table public.bill_splits
  alter column table_number type text using table_number::text;

alter table public.print_jobs drop column if exists table_number;

alter table public.print_jobs
  add column table_number text
  generated always as (
    case jsonb_typeof(payload->'table_number')
      when 'number' then trim((payload->'table_number')::text)
      when 'string' then nullif(btrim(payload->>'table_number'), '')
      else null
    end
  ) stored;

drop function if exists public.merge_multiple_table_sessions(uuid, integer[], integer);
drop function if exists public.transfer_table_session(uuid, integer, integer);
drop function if exists public.merge_table_sessions(uuid, integer, integer);
drop function if exists public.rename_restaurant_table_number(uuid, integer, integer);

create or replace function public.rename_restaurant_table_number(
  p_restaurant_id uuid,
  p_from_table text,
  p_to_table text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_from_table = p_to_table then
    return;
  end if;

  if not exists (
    select 1 from public.restaurants
    where id = p_restaurant_id and owner_id = auth.uid()
  ) then
    raise exception 'forbidden';
  end if;

  if exists (
    select 1 from public.table_sessions
    where restaurant_id = p_restaurant_id
      and table_number = p_to_table
      and status in ('open', 'billing')
  ) then
    raise exception 'target_table_has_active_session';
  end if;

  update public.table_sessions
  set table_number = p_to_table
  where restaurant_id = p_restaurant_id and table_number = p_from_table;

  update public.orders
  set table_number = p_to_table
  where restaurant_id = p_restaurant_id and table_number = p_from_table;

  update public.print_jobs
  set payload = jsonb_set(
    coalesce(payload, '{}'::jsonb),
    '{table_number}',
    to_jsonb(p_to_table),
    true
  )
  where restaurant_id = p_restaurant_id and table_number = p_from_table;
end;
$$;

grant execute on function public.rename_restaurant_table_number(uuid, text, text) to authenticated;

create or replace function public.transfer_table_session(
  p_restaurant_id uuid,
  p_from_table text,
  p_to_table text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source_session public.table_sessions%rowtype;
  v_target_session_id uuid;
begin
  if p_from_table = p_to_table then
    raise exception 'source and target table cannot be the same';
  end if;

  select *
  into v_source_session
  from public.table_sessions
  where restaurant_id = p_restaurant_id
    and table_number = p_from_table
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
    and table_number = p_to_table
    and status in ('open', 'billing')
  order by opened_at desc
  limit 1
  for update;

  if v_target_session_id is not null then
    raise exception 'target table already has active session';
  end if;

  update public.table_sessions
  set table_number = p_to_table
  where id = v_source_session.id;

  update public.orders
  set table_number = p_to_table,
      session_id = coalesce(session_id, v_source_session.id)
  where restaurant_id = p_restaurant_id
    and table_number = p_from_table
    and status in ('pending', 'cooking', 'done')
    and (session_id is null or session_id = v_source_session.id);

  update public.bill_splits
  set table_number = p_to_table,
      session_id = coalesce(session_id, v_source_session.id)
  where restaurant_id = p_restaurant_id
    and table_number = p_from_table
    and status in ('pending', 'confirmed', 'requested')
    and (session_id is null or session_id = v_source_session.id);

  return v_source_session.id;
end;
$$;

create or replace function public.merge_table_sessions(
  p_restaurant_id uuid,
  p_source_table text,
  p_target_table text
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
begin
  if p_source_table = p_target_table then
    raise exception 'source and target table cannot be the same';
  end if;

  select *
  into v_source_session
  from public.table_sessions
  where restaurant_id = p_restaurant_id
    and table_number = p_source_table
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
    and table_number = p_target_table
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
    and table_number = p_source_table
    and status in ('pending', 'confirmed', 'requested')
    and session_id is null;

  update public.bill_splits
  set session_id = v_target_session.id
  where restaurant_id = p_restaurant_id
    and table_number = p_target_table
    and status in ('pending', 'confirmed', 'requested')
    and session_id is null;

  update public.orders
  set session_id = v_target_session.id,
      table_number = p_target_table
  where restaurant_id = p_restaurant_id
    and table_number = p_source_table
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
        table_number = p_target_table
    where id = v_source_split.id;
  end if;

  update public.bill_splits
  set session_id = v_target_session.id,
      table_number = p_target_table
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
  p_source_tables text[],
  p_target_table text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source_table text;
  v_target_session_id uuid;
begin
  if p_source_tables is null or array_length(p_source_tables, 1) is null then
    raise exception 'source tables cannot be empty';
  end if;

  if p_target_table = any(p_source_tables) then
    raise exception 'target table cannot be included in source tables';
  end if;

  foreach v_source_table in array p_source_tables loop
    v_target_session_id := public.merge_table_sessions(
      p_restaurant_id,
      v_source_table,
      p_target_table
    );
  end loop;

  return v_target_session_id;
end;
$$;

grant execute on function public.transfer_table_session(uuid, text, text) to authenticated;
grant execute on function public.merge_table_sessions(uuid, text, text) to authenticated;
grant execute on function public.merge_multiple_table_sessions(uuid, text[], text) to authenticated;

revoke execute on function public.transfer_table_session(uuid, text, text) from anon;
revoke execute on function public.merge_table_sessions(uuid, text, text) from anon;
revoke execute on function public.merge_multiple_table_sessions(uuid, text[], text) from anon;
