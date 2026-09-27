-- reconcile paid flags must use allocated折后义务 (same as confirm collect), not independent round.

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
  v_frozen numeric[];
  v_obligations numeric[];
  v_independent numeric;
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
  v_frozen := ARRAY[]::numeric[];
  v_bill_pre := 0;
  for v_i in 0 .. v_len - 1 loop
    v_row := p_result -> v_i;
    v_pre_amounts := array_append(v_pre_amounts, coalesce((v_row ->> 'amount')::numeric, 0));
    v_bill_pre := v_bill_pre + coalesce((v_row ->> 'amount')::numeric, 0);
    v_independent := public.checkout_round_discount_amount(
      coalesce((v_row ->> 'amount')::numeric, 0),
      p_discount_rate
    );
    v_collected := public.session_person_collected_by_index(
      p_restaurant_id,
      p_session_id,
      v_i
    );
    if v_collected > 0 and round(v_collected, 2) >= round(v_independent, 2) then
      v_frozen := array_append(v_frozen, v_independent);
    else
      v_frozen := array_append(v_frozen, NULL);
    end if;
  end loop;

  v_obligations := public.checkout_allocate_discounted_obligations(
    v_pre_amounts,
    p_discount_rate,
    v_bill_pre,
    v_frozen
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
  'Stamp result[].paid from ledger vs allocated折后义务.';
