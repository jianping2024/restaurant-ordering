-- Collect payment tender: CASH|MULTIBANCO|MIXED + payment_lines; buffet vat_rate default 13.
-- Auth: docs/product/collect-payment-receipt-iva.zh.md

-- 1) Buffet IVA (percent points; same tiers as menu_items)
ALTER TABLE public.buffets
  ADD COLUMN IF NOT EXISTS vat_rate numeric(5, 2) NOT NULL DEFAULT 13;

ALTER TABLE public.buffets
  DROP CONSTRAINT IF EXISTS buffets_vat_rate_range;
ALTER TABLE public.buffets
  ADD CONSTRAINT buffets_vat_rate_range
  CHECK (vat_rate >= 0 AND vat_rate <= 100);

COMMENT ON COLUMN public.buffets.vat_rate IS
  'VAT / IVA rate in percent for buffet headcount lines (e.g. 13). Required; default 13.';

-- 2) Ledger payment_lines + narrow payment_method
ALTER TABLE public.session_collected_payments
  ADD COLUMN IF NOT EXISTS payment_lines jsonb;

COMMENT ON COLUMN public.session_collected_payments.payment_lines IS
  'Sole multi-tender split [{method:CASH|MULTIBANCO, amount:"x.xx"}, …]; required for MIXED.';

UPDATE public.session_collected_payments
SET payment_method = 'MULTIBANCO'
WHERE payment_method = 'CARD';

UPDATE public.session_collected_payments
SET payment_method = 'MULTIBANCO'
WHERE payment_method IN ('MBWAY', 'OTHER');

ALTER TABLE public.session_collected_payments
  DROP CONSTRAINT IF EXISTS session_collected_payments_payment_method_check;

ALTER TABLE public.session_collected_payments
  ADD CONSTRAINT session_collected_payments_payment_method_check
  CHECK (
    payment_method IS NULL
    OR payment_method = ANY (ARRAY['CASH'::text, 'MULTIBANCO'::text, 'MIXED'::text])
  );

COMMENT ON COLUMN public.session_collected_payments.payment_method IS
  'CASH | MULTIBANCO | MIXED (sole collect/invoice codes).';

-- 3) confirm RPC: 8th arg payment_lines; only three methods
DROP FUNCTION IF EXISTS public.confirm_bill_split_payment(uuid, uuid, integer, numeric, uuid, text, boolean);

CREATE OR REPLACE FUNCTION public.confirm_bill_split_payment(
  p_restaurant_id uuid,
  p_bill_split_id uuid,
  p_person_index integer,
  p_collected_amount numeric default null,
  p_created_by_user_id uuid default null,
  p_payment_method text default null,
  p_hold_open boolean default false,
  p_payment_lines jsonb default null
) returns jsonb
language plpgsql
security definer
set search_path to public
as $$
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

  v_row := v_base_rows -> p_person_index;
  v_person_name := coalesce(v_row ->> 'name', '');
  v_obligation := public.checkout_round_discount_amount(
    coalesce((v_row ->> 'amount')::numeric, 0),
    v_split.discount_rate
  );

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

  for v_i in 0 .. v_len - 1 loop
    v_obligation := public.checkout_round_discount_amount(
      coalesce((v_next_result -> v_i ->> 'amount')::numeric, 0),
      v_split.discount_rate
    );
    if v_obligation <= 0 then
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
$$;

revoke all on function public.confirm_bill_split_payment(uuid, uuid, integer, numeric, uuid, text, boolean, jsonb) from public;
grant execute on function public.confirm_bill_split_payment(uuid, uuid, integer, numeric, uuid, text, boolean, jsonb) to authenticated, service_role;
