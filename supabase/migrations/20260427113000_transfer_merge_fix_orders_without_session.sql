-- ============================================================
-- Transfer/merge compatibility for legacy orders without session_id
-- ============================================================

create or replace function public.transfer_table_session(
  p_restaurant_id uuid,
  p_from_table integer,
  p_to_table integer
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

  -- Move active orders on source table even if historical rows have null session_id.
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
  p_source_table integer,
  p_target_table integer
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

  -- Normalize legacy bill splits that were created before session_id was introduced.
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

  -- Move source orders even when they do not yet have session_id.
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

grant execute on function public.transfer_table_session(uuid, integer, integer) to anon, authenticated;
grant execute on function public.merge_table_sessions(uuid, integer, integer) to anon, authenticated;
