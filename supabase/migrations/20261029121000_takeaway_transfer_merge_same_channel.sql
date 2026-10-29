-- In-store takeaway: transfer/merge only when both sides share the same ordering channel.
-- Source uses stamped session.ordering_channel; empty target uses flag ∧ is_takeaway group
-- (same rule as resolveTableOrderingChannel with no session).

create or replace function public.table_would_be_takeaway_channel(
  p_restaurant_id uuid,
  p_table_id uuid
) returns boolean
language plpgsql
stable
security definer
set search_path to public
as $$
declare
  v_flags jsonb;
  v_enabled boolean;
  v_in_group boolean;
begin
  select feature_flags into v_flags
  from public.restaurants
  where id = p_restaurant_id;
  v_enabled := coalesce((v_flags ->> 'takeaway_ordering')::boolean, false);
  if not v_enabled then
    return false;
  end if;

  select exists (
    select 1
    from public.restaurant_table_group_members m
    join public.restaurant_table_groups g on g.id = m.group_id
    where m.restaurant_id = p_restaurant_id
      and m.table_id = p_table_id
      and g.is_takeaway = true
  ) into v_in_group;

  return coalesce(v_in_group, false);
end;
$$;

create or replace function public.transfer_table_session(
  p_restaurant_id uuid,
  p_from_table_id uuid,
  p_to_table_id uuid,
  p_operator_user_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path to public
as $$
declare
  v_source_session public.table_sessions%rowtype;
  v_target_session_id uuid;
  v_target_display text;
  v_from_display text;
  v_operator_id uuid;
  v_source_takeaway boolean;
  v_target_takeaway boolean;
begin
  v_operator_id := coalesce(p_operator_user_id, auth.uid());
  perform public.assert_restaurant_session_operator(p_restaurant_id, v_operator_id);

  if p_from_table_id = p_to_table_id then
    raise exception 'source and target table cannot be the same';
  end if;

  select display_name into v_target_display
  from public.get_active_restaurant_table(p_restaurant_id, p_to_table_id);
  if v_target_display is null then
    raise exception 'invalid target table';
  end if;

  select display_name into v_from_display
  from public.get_active_restaurant_table(p_restaurant_id, p_from_table_id);
  if v_from_display is null then
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

  v_source_takeaway := coalesce(v_source_session.ordering_channel, 'dine_in') = 'takeaway';
  v_target_takeaway := public.table_would_be_takeaway_channel(p_restaurant_id, p_to_table_id);
  if v_source_takeaway is distinct from v_target_takeaway then
    raise exception 'ordering_channel_mismatch';
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

  update public.table_order_rounds
  set table_id = p_to_table_id,
      updated_at = now()
  where session_id = v_source_session.id
    and status in ('collecting', 'pending_confirm', 'cooldown', 'finalize_failed');

  insert into public.table_session_events (
    restaurant_id,
    session_id,
    event_type,
    occurred_at,
    operator_user_id,
    from_table_id,
    to_table_id,
    from_display_name,
    to_display_name
  ) values (
    p_restaurant_id,
    v_source_session.id,
    'transfer',
    now(),
    v_operator_id,
    p_from_table_id,
    p_to_table_id,
    v_from_display,
    v_target_display
  );

  return v_source_session.id;
end;
$$;

-- Merge: both live sessions must share ordering_channel (stamped at open).
-- Patch via wrapper check function called from app + enforce here with a
-- statement trigger substitute: recreate only the early gate using DO + dynamic
-- is fragile; instead replace merge by fetching body is too large — enforce with
-- a BEFORE-style guard function that RPCs call… App also gates. SQL: add check
-- by replacing merge with CREATE OR REPLACE that includes the same body from
-- 20260812154028 plus channel assert after both sessions lock.

-- Minimal approach: raise in a dedicated assert used by app; for DB path,
-- create trigger on table_sessions that blocks merge_into when channels differ
-- (merge sets merge_into_session_id on the source while closing it).

create or replace function public.reject_cross_channel_session_merge()
returns trigger
language plpgsql
security definer
set search_path to public
as $$
declare
  v_target_channel text;
begin
  if new.merge_into_session_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE'
    and old.merge_into_session_id is not distinct from new.merge_into_session_id
  then
    return new;
  end if;

  select ordering_channel into v_target_channel
  from public.table_sessions
  where id = new.merge_into_session_id
    and restaurant_id = new.restaurant_id;

  if v_target_channel is null then
    return new;
  end if;

  if coalesce(new.ordering_channel, 'dine_in') is distinct from coalesce(v_target_channel, 'dine_in') then
    raise exception 'ordering_channel_mismatch';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_reject_cross_channel_session_merge on public.table_sessions;
create trigger trg_reject_cross_channel_session_merge
  before update of merge_into_session_id on public.table_sessions
  for each row
  execute function public.reject_cross_channel_session_merge();
