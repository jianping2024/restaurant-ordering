-- Collect payment idempotency: a retried confirm (same client_request_id) must not collect twice.
-- Partial / mixed collects were the gap: only the full-pay case was protected by `already_paid`.

alter table public.session_collected_payments
  add column if not exists client_request_id uuid;

create unique index if not exists session_collected_payments_client_request_uidx
  on public.session_collected_payments (restaurant_id, client_request_id)
  where client_request_id is not null;

drop function if exists public.confirm_bill_split_payment(
  uuid, uuid, integer, numeric, uuid, text, boolean, jsonb
);

create or replace FUNCTION public.confirm_bill_split_payment(p_restaurant_id uuid, p_bill_split_id uuid, p_person_index integer, p_collected_amount numeric DEFAULT NULL::numeric, p_created_by_user_id uuid DEFAULT NULL::uuid, p_payment_method text DEFAULT NULL::text, p_hold_open boolean DEFAULT false, p_payment_lines jsonb DEFAULT NULL::jsonb, p_client_request_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_split public.bill_splits%rowtype;
  v_raw_result jsonb;
  v_base_rows jsonb;
  v_next_result jsonb;
  v_row jsonb;
  v_all_paid boolean := true;
  v_final_amount numeric := 0;
  v_i integer;
  v_len integer;
  v_session public.table_sessions%rowtype;
  v_session_id uuid;
  v_precheck_status text;
  v_obligation numeric;
  v_collected numeric;
  v_prior_collected numeric;
  v_outstanding numeric;
  v_person_name text;
  v_payment_id uuid;
  v_payment_method text;
  v_payment_lines jsonb;
  v_line jsonb;
  v_line_sum numeric := 0;
  v_has_cash boolean := false;
  v_has_mb boolean := false;
  v_line_method text;
  v_line_amount numeric;
  v_pre_amounts numeric[];
  v_obligations numeric[];
  v_dup public.session_collected_payments%rowtype;
begin
  if p_person_index is null or p_person_index < 0 then
    return jsonb_build_object('ok', false, 'code', 'invalid_person_index');
  end if;

  v_payment_method := upper(trim(coalesce(p_payment_method, '')));
  if v_payment_method = '' then
    v_payment_method := null;
  elsif v_payment_method not in ('CASH', 'MULTIBANCO', 'MIXED') then
    return jsonb_build_object('ok', false, 'code', 'invalid_payment_method');
  end if;

  v_payment_lines := p_payment_lines;
  if v_payment_method = 'MIXED' then
    if v_payment_lines is null or jsonb_typeof(v_payment_lines) <> 'array'
       or jsonb_array_length(v_payment_lines) < 2 then
      return jsonb_build_object('ok', false, 'code', 'missing_payment_lines');
    end if;
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

  -- Idempotent replay: the same collect attempt (client_request_id) answers with the stored
  -- payment instead of collecting again. Serialized with first writes by the session lock above.
  if p_client_request_id is not null then
    select * into v_dup
    from public.session_collected_payments
    where restaurant_id = p_restaurant_id
      and client_request_id = p_client_request_id;
    if found then
      if v_dup.bill_split_id is distinct from p_bill_split_id
         or v_dup.person_index is distinct from p_person_index
         or (p_collected_amount is not null
             and round(v_dup.amount, 2) <> round(p_collected_amount, 2)) then
        return jsonb_build_object('ok', false, 'code', 'client_request_id_conflict');
      end if;
      v_next_result := coalesce(v_split.result, '[]'::jsonb);
      v_all_paid := v_split.status = 'paid';
      if v_all_paid and v_split.session_id is not null then
        v_final_amount := public.session_total_collected(p_restaurant_id, v_split.session_id);
      else
        select coalesce(sum((elem->>'amount')::numeric), 0)
        into v_final_amount
        from jsonb_array_elements(v_next_result) as elem;
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
        'row_name', v_dup.person_name,
        'row_amount', v_dup.amount,
        'collected_payment_id', v_dup.id,
        'confirmed_person_index', v_dup.person_index,
        'payment_method', v_dup.payment_method,
        'payment_lines', v_dup.payment_lines,
        'newly_paid', false,
        'should_print_split', false,
        'should_print_final', false,
        'should_close_session', false
      );
    end if;
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

  -- One-cut折后义务 (no freeze / re-split after collects)
  v_pre_amounts := ARRAY[]::numeric[];
  for v_i in 0 .. v_len - 1 loop
    v_row := v_base_rows -> v_i;
    v_pre_amounts := array_append(v_pre_amounts, coalesce((v_row ->> 'amount')::numeric, 0));
  end loop;

  v_obligations := public.checkout_allocate_discounted_obligations(
    v_pre_amounts,
    v_split.discount_rate,
    v_split.total_amount,
    NULL
  );

  v_row := v_base_rows -> p_person_index;
  v_person_name := coalesce(v_row ->> 'name', '');
  v_obligation := v_obligations[p_person_index + 1];

  if v_split.session_id is not null then
    v_prior_collected := public.session_person_collected_by_index(
      p_restaurant_id,
      v_split.session_id,
      p_person_index
    );
  else
    v_prior_collected := 0;
  end if;

  v_outstanding := round(v_obligation - v_prior_collected, 2);
  if v_outstanding <= 0 then
    return jsonb_build_object('ok', false, 'code', 'already_paid');
  end if;

  v_collected := coalesce(p_collected_amount, v_outstanding);
  if v_collected <= 0 then
    return jsonb_build_object('ok', false, 'code', 'invalid_collected_amount');
  end if;

  if round(v_collected, 2) > round(v_outstanding, 2) then
    return jsonb_build_object('ok', false, 'code', 'invalid_collected_amount');
  end if;

  if v_payment_method = 'MIXED' then
    for v_i in 0 .. jsonb_array_length(v_payment_lines) - 1 loop
      v_line := v_payment_lines -> v_i;
      v_line_method := upper(trim(coalesce(v_line ->> 'method', '')));
      v_line_amount := coalesce((v_line ->> 'amount')::numeric, 0);
      if v_line_method not in ('CASH', 'MULTIBANCO') or v_line_amount <= 0 then
        return jsonb_build_object('ok', false, 'code', 'invalid_payment_lines');
      end if;
      if v_line_method = 'CASH' then v_has_cash := true; end if;
      if v_line_method = 'MULTIBANCO' then v_has_mb := true; end if;
      v_line_sum := v_line_sum + v_line_amount;
    end loop;
    if not v_has_cash or not v_has_mb then
      return jsonb_build_object('ok', false, 'code', 'invalid_payment_lines');
    end if;
    if round(v_line_sum, 2) <> round(v_collected, 2) then
      return jsonb_build_object('ok', false, 'code', 'payment_lines_amount_mismatch');
    end if;
  end if;

  if v_split.session_id is not null then
    insert into public.session_collected_payments (
      restaurant_id,
      session_id,
      person_index,
      person_name,
      amount,
      bill_split_id,
      created_by_user_id,
      payment_method,
      payment_lines,
      client_request_id
    ) values (
      p_restaurant_id,
      v_split.session_id,
      p_person_index,
      v_person_name,
      v_collected,
      p_bill_split_id,
      p_created_by_user_id,
      v_payment_method,
      v_payment_lines,
      p_client_request_id
    )
    returning id into v_payment_id;
  end if;

  v_next_result := public.reconcile_split_result_paid_from_ledger(
    v_base_rows,
    p_restaurant_id,
    v_split.session_id,
    v_split.discount_rate
  );

  -- Same one-cut obligations for all_paid (reconcile stamps paid)
  v_pre_amounts := ARRAY[]::numeric[];
  for v_i in 0 .. v_len - 1 loop
    v_row := v_next_result -> v_i;
    v_pre_amounts := array_append(v_pre_amounts, coalesce((v_row ->> 'amount')::numeric, 0));
  end loop;
  v_obligations := public.checkout_allocate_discounted_obligations(
    v_pre_amounts,
    v_split.discount_rate,
    v_split.total_amount,
    NULL
  );
  for v_i in 0 .. v_len - 1 loop
    v_obligation := v_obligations[v_i + 1];
    if coalesce(v_obligation, 0) <= 0 then
      continue;
    end if;
    if not coalesce((v_next_result -> v_i ->> 'paid')::boolean, false) then
      v_all_paid := false;
      exit;
    end if;
  end loop;

  if coalesce(p_hold_open, false) then
    v_all_paid := false;
  end if;

  if v_all_paid and v_split.session_id is not null then
    v_final_amount := public.session_total_collected(
      p_restaurant_id,
      v_split.session_id
    );
  else
    select coalesce(sum((elem->>'amount')::numeric), 0)
    into v_final_amount
    from jsonb_array_elements(v_base_rows) as elem;
  end if;

  update public.bill_splits
  set
    status = case when v_all_paid then 'paid' else 'requested' end,
    total_amount = v_split.total_amount,
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
        closed_at = now(),
        closed_by_user_id = p_created_by_user_id
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
    'row_amount', v_collected,
    'collected_payment_id', v_payment_id,
    'confirmed_person_index', p_person_index,
    'payment_method', v_payment_method,
    'payment_lines', v_payment_lines,
    'newly_paid', true,
    'should_print_split', false,
    'should_print_final', false,
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
$function$;

revoke all on function public.confirm_bill_split_payment(
  uuid, uuid, integer, numeric, uuid, text, boolean, jsonb, uuid
) from public;
grant execute on function public.confirm_bill_split_payment(
  uuid, uuid, integer, numeric, uuid, text, boolean, jsonb, uuid
) to authenticated, service_role;
