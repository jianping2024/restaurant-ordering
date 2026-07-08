-- By-item splits are preserved on resume regardless of partial payment.

create or replace function public.resume_table_session_ordering(
  p_restaurant_id uuid,
  p_table_id uuid
) returns jsonb
language plpgsql
security definer
set search_path to public
as $$
declare
  v_session public.table_sessions%rowtype;
  v_split public.bill_splits%rowtype;
  v_row jsonb;
  v_len integer;
  v_i integer;
  v_has_paid_row boolean := false;
  v_has_partial_payment boolean := false;
  v_preserve_split boolean := false;
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

  select *
  into v_session
  from public.table_sessions
  where id = v_session.id
    and restaurant_id = p_restaurant_id
  for update;

  if v_session.status not in ('open', 'billing') then
    return jsonb_build_object('ok', false, 'code', 'no_session');
  end if;

  select *
  into v_split
  from public.bill_splits
  where restaurant_id = p_restaurant_id
    and session_id = v_session.id
    and status in ('pending', 'confirmed', 'requested')
  order by created_at desc
  limit 1
  for update;

  if found then
    v_len := jsonb_array_length(coalesce(v_split.result, '[]'::jsonb));
    if v_len > 0 then
      for v_i in 0 .. v_len - 1 loop
        v_row := v_split.result -> v_i;
        if coalesce((v_row->>'paid')::boolean, false) then
          v_has_paid_row := true;
          exit;
        end if;
      end loop;
    end if;

    v_has_partial_payment := v_has_paid_row or exists (
      select 1
      from public.session_collected_payments scp
      where scp.restaurant_id = p_restaurant_id
        and scp.session_id = v_session.id
    );

    if v_len <= 1 then
      if v_has_partial_payment then
        return jsonb_build_object('ok', false, 'code', 'whole_table_paid');
      end if;
    end if;

    v_preserve_split := v_split.split_mode = 'by_item' or v_has_partial_payment;

    if v_preserve_split then
      update public.bill_splits
      set status = 'confirmed'
      where restaurant_id = p_restaurant_id
        and session_id = v_session.id
        and status in ('pending', 'confirmed', 'requested');
    else
      update public.bill_splits
      set status = 'cancelled'
      where restaurant_id = p_restaurant_id
        and session_id = v_session.id
        and status in ('pending', 'confirmed', 'requested');
    end if;
  end if;

  update public.table_sessions
  set status = 'open'
  where id = v_session.id
    and status = 'billing';

  return jsonb_build_object(
    'ok', true,
    'session_id', v_session.id,
    'table_id', p_table_id
  );
exception
  when others then
    return jsonb_build_object(
      'ok', false,
      'code', 'resume_failed',
      'message', sqlerrm
    );
end;
$$;
revoke all on function public.resume_table_session_ordering(uuid, uuid) from public;
grant execute on function public.resume_table_session_ordering(uuid, uuid)
  to authenticated, service_role;
