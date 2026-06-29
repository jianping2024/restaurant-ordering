-- Bill-level checkout discount persisted on bill_splits; confirm payment reads it from the row.

alter table public.bill_splits
  add column if not exists discount_rate numeric not null default 0,
  add column if not exists discount_reason text,
  add column if not exists discount_reason_detail text;

alter table public.bill_splits
  add constraint bill_splits_discount_rate_range
  check (discount_rate >= 0 and discount_rate <= 100);

comment on column public.bill_splits.discount_rate is
  'Checkout discount percent (0–100) applied to the whole bill before split collection.';
comment on column public.bill_splits.discount_reason is
  'Abnormal-operation reason code when discount_rate > 0.';
comment on column public.bill_splits.discount_reason_detail is
  'Optional detail when discount_reason requires it.';

create or replace function public.confirm_bill_split_payment(
  p_restaurant_id uuid,
  p_bill_split_id uuid,
  p_person_index integer
) returns jsonb
language plpgsql
security definer
set search_path to public
as $$
declare
  v_split public.bill_splits%rowtype;
  v_raw_result jsonb;
  v_base_rows jsonb;
  v_discounted jsonb;
  v_next_result jsonb := '[]'::jsonb;
  v_elem jsonb;
  v_row jsonb;
  v_all_paid boolean := true;
  v_final_amount numeric := 0;
  v_rate numeric;
  v_factor numeric;
  v_i integer;
  v_len integer;
  v_session public.table_sessions%rowtype;
  v_was_paid boolean;
  v_session_id uuid;
  v_precheck_status text;
begin
  if p_person_index is null or p_person_index < 0 then
    return jsonb_build_object('ok', false, 'code', 'invalid_person_index');
  end if;

  select session_id, status
  into v_session_id, v_precheck_status
  from public.bill_splits
  where id = p_bill_split_id
    and restaurant_id = p_restaurant_id;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'bill_split_not_found');
  end if;

  if v_precheck_status = 'cancelled' then
    return jsonb_build_object('ok', false, 'code', 'bill_split_cancelled');
  end if;

  if v_session_id is not null then
    perform pg_advisory_xact_lock(hashtext(v_session_id::text));
  end if;

  select *
  into v_split
  from public.bill_splits
  where id = p_bill_split_id
    and restaurant_id = p_restaurant_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'bill_split_not_found');
  end if;

  if v_split.status = 'cancelled' then
    return jsonb_build_object('ok', false, 'code', 'bill_split_cancelled');
  end if;

  v_raw_result := coalesce(v_split.result, '[]'::jsonb);
  if jsonb_typeof(v_raw_result) <> 'array' then
    v_raw_result := '[]'::jsonb;
  end if;

  if jsonb_array_length(v_raw_result) = 0 then
    if coalesce(v_split.total_amount, 0) > 0 then
      v_base_rows := jsonb_build_array(
        jsonb_build_object('name', 'Total', 'amount', v_split.total_amount)
      );
    else
      return jsonb_build_object('ok', false, 'code', 'empty_split');
    end if;
  else
    v_base_rows := v_raw_result;
  end if;

  v_len := jsonb_array_length(v_base_rows);
  if p_person_index >= v_len then
    return jsonb_build_object('ok', false, 'code', 'invalid_person_index');
  end if;

  v_rate := greatest(0, least(100, coalesce(v_split.discount_rate, 0)));
  v_factor := 1 - v_rate / 100;

  select coalesce(
    jsonb_agg(
      elem || jsonb_build_object(
        'amount',
        coalesce((elem->>'amount')::numeric, 0) * v_factor
      )
    ),
    '[]'::jsonb
  )
  into v_discounted
  from jsonb_array_elements(v_base_rows) as elem;

  v_row := v_discounted -> p_person_index;
  v_was_paid := coalesce((v_row->>'paid')::boolean, false);
  if v_was_paid then
    return jsonb_build_object('ok', false, 'code', 'already_paid');
  end if;

  for v_i in 0 .. v_len - 1 loop
    v_elem := v_discounted -> v_i;
    if v_i = p_person_index then
      v_elem := v_elem || jsonb_build_object('paid', true);
    end if;
    v_next_result := v_next_result || jsonb_build_array(v_elem);
  end loop;

  for v_i in 0 .. v_len - 1 loop
    if not coalesce((v_next_result -> v_i ->> 'paid')::boolean, false) then
      v_all_paid := false;
      exit;
    end if;
  end loop;

  select coalesce(sum((elem->>'amount')::numeric), 0)
  into v_final_amount
  from jsonb_array_elements(v_next_result) as elem;

  update public.bill_splits
  set
    status = case when v_all_paid then 'paid' else 'requested' end,
    total_amount = case when v_all_paid then v_final_amount else v_split.total_amount end,
    result = v_next_result
  where id = p_bill_split_id;

  v_row := v_next_result -> p_person_index;

  if v_all_paid and v_split.session_id is not null then
    select *
    into v_session
    from public.table_sessions
    where id = v_split.session_id
    for update;

    if not found then
      return jsonb_build_object(
        'ok', false,
        'code', 'session_close_failed',
        'message', 'session not found'
      );
    end if;

    if v_session.status = 'closed' then
      return jsonb_build_object(
        'ok', false,
        'code', 'session_close_failed',
        'message', 'session already closed'
      );
    end if;

    update public.table_sessions
    set status = 'closed',
        closed_at = now()
    where id = v_split.session_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'all_paid', v_all_paid,
    'result', v_next_result,
    'final_amount', v_final_amount,
    'session_id', v_split.session_id,
    'table_id', v_split.table_id,
    'display_name', v_split.display_name,
    'order_ids', coalesce(to_jsonb(v_split.order_ids), '[]'::jsonb),
    'row_name', v_row ->> 'name',
    'row_amount', coalesce((v_row->>'amount')::numeric, 0),
    'confirmed_person_index', p_person_index,
    'newly_paid', true,
    'should_print_split',
      v_split.session_id is not null and v_len > 1,
    'should_print_final',
      v_all_paid and v_split.session_id is not null,
    'should_close_session',
      v_all_paid and v_split.session_id is not null
  );
exception
  when others then
    return jsonb_build_object(
      'ok', false,
      'code', 'bill_update_failed',
      'message', sqlerrm
    );
end;
$$;

revoke all on function public.confirm_bill_split_payment(uuid, uuid, integer, numeric) from public;
revoke all on function public.confirm_bill_split_payment(uuid, uuid, integer, numeric) from authenticated;
revoke all on function public.confirm_bill_split_payment(uuid, uuid, integer, numeric) from service_role;

revoke all on function public.confirm_bill_split_payment(uuid, uuid, integer) from public;
grant execute on function public.confirm_bill_split_payment(uuid, uuid, integer)
  to authenticated, service_role;
