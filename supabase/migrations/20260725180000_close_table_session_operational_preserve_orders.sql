-- Operational force/nightly close: cancel unpaid splits and close session.
-- Preserve order lines and totals — revenue exclusion is by closed_reason / abnormal
-- markers, not by voiding amounts.

create or replace function public.close_table_session_operational(
  p_restaurant_id uuid,
  p_table_id uuid,
  p_closed_reason text,
  p_closed_by_user_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path to public
as $$
declare
  v_session public.table_sessions%rowtype;
  v_now timestamptz := now();
begin
  select *
  into v_session
  from public.table_sessions
  where restaurant_id = p_restaurant_id
    and table_id = p_table_id
    and status in ('open', 'billing')
  order by opened_at desc
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'no_session');
  end if;

  perform pg_advisory_xact_lock(hashtext(v_session.id::text));

  perform 1
  from public.bill_splits
  where restaurant_id = p_restaurant_id
    and session_id = v_session.id
    and status in ('pending', 'confirmed', 'requested')
  for update;

  select *
  into v_session
  from public.table_sessions
  where id = v_session.id
    and restaurant_id = p_restaurant_id
  for update;

  if v_session.status not in ('open', 'billing') then
    return jsonb_build_object('ok', false, 'code', 'no_session');
  end if;

  update public.bill_splits
  set status = 'cancelled'
  where restaurant_id = p_restaurant_id
    and session_id = v_session.id
    and status in ('pending', 'confirmed', 'requested');

  update public.table_sessions
  set
    status = 'closed',
    closed_at = v_now,
    closed_reason = p_closed_reason,
    closed_by_user_id = p_closed_by_user_id
  where id = v_session.id;

  return jsonb_build_object('ok', true, 'session_id', v_session.id);
exception
  when others then
    return jsonb_build_object(
      'ok', false,
      'code', 'update_failed',
      'message', sqlerrm
    );
end;
$$;

revoke all on function public.close_table_session_operational(
  uuid, uuid, text, uuid
) from public;
grant execute on function public.close_table_session_operational(
  uuid, uuid, text, uuid
) to authenticated, service_role;
