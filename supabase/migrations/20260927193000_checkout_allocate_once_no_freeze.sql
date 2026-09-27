-- New system: one-cut allocate only. No freeze / re-split after partial collects.


-- One-cut allocate: ignore p_frozen_obligations (new system; no freeze re-split).
CREATE OR REPLACE FUNCTION public.checkout_allocate_discounted_obligations(
  p_pre_amounts numeric[],
  p_discount_rate numeric,
  p_bill_total numeric DEFAULT NULL,
  p_frozen_obligations numeric[] DEFAULT NULL
) RETURNS numeric[]
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO public
AS $$
DECLARE
  v_n integer;
  v_rate numeric;
  v_bill_pre numeric := 0;
  v_payable_cents bigint;
  v_out bigint[];
  v_weights bigint[];
  v_open_cents bigint[];
  v_weight_sum bigint := 0;
  v_i integer;
  v_rem bigint;
BEGIN
  -- p_frozen_obligations intentionally unused (signature kept for callers).
  PERFORM p_frozen_obligations;

  v_n := coalesce(cardinality(p_pre_amounts), 0);
  IF v_n = 0 THEN
    RETURN ARRAY[]::numeric[];
  END IF;

  v_rate := least(100, greatest(0, coalesce(p_discount_rate, 0)));
  IF v_rate <= 0 THEN
    RETURN (
      SELECT array_agg(round(coalesce(a, 0), 2) ORDER BY ord)
      FROM unnest(p_pre_amounts) WITH ORDINALITY AS t(a, ord)
    );
  END IF;

  IF p_bill_total IS NOT NULL THEN
    v_bill_pre := coalesce(p_bill_total, 0);
  ELSE
    SELECT coalesce(sum(coalesce(a, 0)), 0) INTO v_bill_pre FROM unnest(p_pre_amounts) AS a;
  END IF;

  v_payable_cents := round(public.checkout_round_discount_amount(v_bill_pre, v_rate) * 100)::bigint;
  v_weights := ARRAY[]::bigint[];
  FOR v_i IN 1 .. v_n LOOP
    v_weights := v_weights || greatest(0, round(coalesce(p_pre_amounts[v_i], 0) * 100)::bigint);
  END LOOP;

  SELECT coalesce(sum(w), 0) INTO v_weight_sum FROM unnest(v_weights) AS w;
  v_open_cents := array_fill(0::bigint, ARRAY[v_n]);

  IF v_weight_sum <= 0 OR v_payable_cents <= 0 THEN
    IF v_payable_cents > 0 THEN
      v_open_cents[1] := v_payable_cents;
    END IF;
  ELSE
    FOR v_i IN 1 .. v_n LOOP
      v_open_cents[v_i] := (v_payable_cents * v_weights[v_i]) / v_weight_sum;
    END LOOP;
    v_rem := v_payable_cents - (SELECT coalesce(sum(c), 0) FROM unnest(v_open_cents) AS c);
    FOR v_i IN 1 .. v_n LOOP
      EXIT WHEN v_rem <= 0;
      v_open_cents[v_i] := v_open_cents[v_i] + 1;
      v_rem := v_rem - 1;
    END LOOP;
  END IF;

  RETURN (
    SELECT array_agg((c::numeric / 100) ORDER BY ord)
    FROM unnest(v_open_cents) WITH ORDINALITY AS t(c, ord)
  );
END;
$$;

COMMENT ON FUNCTION public.checkout_allocate_discounted_obligations(numeric[], numeric, numeric, numeric[]) IS
  'One-cut bill payable into person obligations; frozen arg ignored.';

CREATE OR REPLACE FUNCTION public.reconcile_split_result_paid_from_ledger(
  p_result jsonb,
  p_restaurant_id uuid,
  p_session_id uuid,
  p_discount_rate numeric DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
declare
  v_result jsonb := '[]'::jsonb;
  v_row jsonb;
  v_len integer;
  v_i integer;
  v_obligation numeric;
  v_collected numeric;
  v_pre_amounts numeric[];
  v_obligations numeric[];
  v_bill_pre numeric;
begin
  if p_session_id is null then
    return coalesce(p_result, '[]'::jsonb);
  end if;

  if jsonb_typeof(coalesce(p_result, '[]'::jsonb)) <> 'array' then
    return '[]'::jsonb;
  end if;

  v_len := jsonb_array_length(p_result);
  if v_len = 0 then
    return p_result;
  end if;

  v_pre_amounts := ARRAY[]::numeric[];
  v_bill_pre := 0;
  for v_i in 0 .. v_len - 1 loop
    v_row := p_result -> v_i;
    v_pre_amounts := array_append(v_pre_amounts, coalesce((v_row ->> 'amount')::numeric, 0));
    v_bill_pre := v_bill_pre + coalesce((v_row ->> 'amount')::numeric, 0);
  end loop;

  v_obligations := public.checkout_allocate_discounted_obligations(
    v_pre_amounts,
    p_discount_rate,
    v_bill_pre,
    NULL
  );

  for v_i in 0 .. v_len - 1 loop
    v_row := p_result -> v_i;
    v_obligation := v_obligations[v_i + 1];
    v_collected := public.session_person_collected_by_index(
      p_restaurant_id,
      p_session_id,
      v_i
    );
    v_row := v_row || jsonb_build_object(
      'paid',
      round(v_collected, 2) >= round(coalesce(v_obligation, 0), 2)
    );
    v_result := v_result || jsonb_build_array(v_row);
  end loop;

  return v_result;
end;
$$;

COMMENT ON FUNCTION public.reconcile_split_result_paid_from_ledger(jsonb, uuid, uuid, numeric) IS
  'Stamp result[].paid from ledger vs one-cut allocated折后义务.';

CREATE OR REPLACE FUNCTION public.confirm_bill_split_payment(p_restaurant_id uuid, p_bill_split_id uuid, p_person_index integer, p_collected_amount numeric DEFAULT NULL::numeric, p_created_by_user_id uuid DEFAULT NULL::uuid, p_payment_method text DEFAULT NULL::text, p_hold_open boolean DEFAULT false, p_payment_lines jsonb DEFAULT NULL::jsonb)
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
      payment_lines
    ) values (
      p_restaurant_id,
      v_split.session_id,
      p_person_index,
      v_person_name,
      v_collected,
      p_bill_split_id,
      p_created_by_user_id,
      v_payment_method,
      v_payment_lines
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


DROP FUNCTION IF EXISTS public.checkout_frozen_discount_obligations(numeric[], numeric, numeric[], numeric);
