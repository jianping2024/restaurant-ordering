alter table public.bill_splits
  add column if not exists customer_nif text;

comment on column public.bill_splits.customer_nif is
  'Optional Portuguese NIF (9 digits) supplied by the guest at checkout request.';

create or replace function public.upsert_bill_split_request(
  p_restaurant_id uuid,
  p_session_id uuid,
  p_table_id uuid,
  p_display_name text,
  p_order_ids uuid[],
  p_split_mode text,
  p_persons jsonb,
  p_result jsonb,
  p_total_amount numeric,
  p_customer_nif text default null
) returns jsonb
language plpgsql
security definer
set search_path to public
as $$
declare
  v_session public.table_sessions%rowtype;
  v_existing public.bill_splits%rowtype;
  v_next_result jsonb;
  v_bill_split_id uuid;
  v_customer_nif text;
begin
  if p_session_id is null or p_table_id is null or p_display_name is null or btrim(p_display_name) = '' then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;

  v_customer_nif := nullif(btrim(coalesce(p_customer_nif, '')), '');

  select *
  into v_session
  from public.table_sessions
  where id = p_session_id
    and restaurant_id = p_restaurant_id
    and table_id = p_table_id
    and status in ('open', 'billing');

  if not found then
    return jsonb_build_object('ok', false, 'code', 'no_active_session');
  end if;

  perform pg_advisory_xact_lock(hashtext(p_session_id::text));

  select *
  into v_session
  from public.table_sessions
  where id = p_session_id
    and restaurant_id = p_restaurant_id
  for update;

  if v_session.status not in ('open', 'billing') then
    return jsonb_build_object('ok', false, 'code', 'no_active_session');
  end if;

  select *
  into v_existing
  from public.bill_splits
  where restaurant_id = p_restaurant_id
    and session_id = p_session_id
    and status in ('pending', 'confirmed', 'requested')
  order by created_at desc
  limit 1
  for update;

  v_next_result := public.merge_split_result_paid(p_result, v_existing.result);

  if v_existing.id is not null then
    update public.bill_splits
    set
      table_id = p_table_id,
      display_name = p_display_name,
      order_ids = coalesce(p_order_ids, '{}'::uuid[]),
      split_mode = p_split_mode,
      persons = coalesce(p_persons, '[]'::jsonb),
      result = v_next_result,
      total_amount = p_total_amount,
      customer_nif = v_customer_nif,
      status = 'requested'
    where id = v_existing.id;

    v_bill_split_id := v_existing.id;
  else
    begin
      insert into public.bill_splits (
        restaurant_id,
        session_id,
        table_id,
        display_name,
        order_ids,
        split_mode,
        persons,
        result,
        total_amount,
        customer_nif,
        status
      ) values (
        p_restaurant_id,
        p_session_id,
        p_table_id,
        p_display_name,
        coalesce(p_order_ids, '{}'::uuid[]),
        p_split_mode,
        coalesce(p_persons, '[]'::jsonb),
        v_next_result,
        p_total_amount,
        v_customer_nif,
        'requested'
      )
      returning id into v_bill_split_id;
    exception
      when unique_violation then
        select *
        into v_existing
        from public.bill_splits
        where restaurant_id = p_restaurant_id
          and session_id = p_session_id
          and status in ('pending', 'confirmed', 'requested')
        order by created_at desc
        limit 1
        for update;

        if not found then
          return jsonb_build_object('ok', false, 'code', 'upsert_failed', 'message', 'unique_violation_without_row');
        end if;

        v_next_result := public.merge_split_result_paid(p_result, v_existing.result);

        update public.bill_splits
        set
          table_id = p_table_id,
          display_name = p_display_name,
          order_ids = coalesce(p_order_ids, '{}'::uuid[]),
          split_mode = p_split_mode,
          persons = coalesce(p_persons, '[]'::jsonb),
          result = v_next_result,
          total_amount = p_total_amount,
          customer_nif = v_customer_nif,
          status = 'requested'
        where id = v_existing.id;

        v_bill_split_id := v_existing.id;
    end;
  end if;

  update public.table_sessions
  set status = 'billing'
  where id = p_session_id
    and status in ('open', 'billing');

  return jsonb_build_object(
    'ok', true,
    'bill_split_id', v_bill_split_id,
    'result', v_next_result,
    'total_amount', p_total_amount
  );
exception
  when others then
    return jsonb_build_object(
      'ok', false,
      'code', 'upsert_failed',
      'message', sqlerrm
    );
end;
$$;

revoke all on function public.upsert_bill_split_request(
  uuid, uuid, uuid, text, uuid[], text, jsonb, jsonb, numeric, text
) from public;
grant execute on function public.upsert_bill_split_request(
  uuid, uuid, uuid, text, uuid[], text, jsonb, jsonb, numeric, text
) to authenticated, service_role;
