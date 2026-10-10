-- Checkout ledger: session_collected_payments.party_id is the person key.
-- Read: party_id first, else person_index (legacy). Unlock no longer shifts indexes.
-- Confirm RPC takes p_party_id. See docs/product/checkout-ledger-party-id.zh.md.

alter table public.session_collected_payments
  add column if not exists party_id uuid;

comment on column public.session_collected_payments.party_id is
  'Stable seat/ticket id (same as bill_splits.result[].party_id). Authoritative for attribution; person_index is legacy-only when this is null.';

create index if not exists session_collected_payments_session_party_idx
  on public.session_collected_payments (session_id, party_id)
  where party_id is not null;

-- Optional safe backfill: active splits where result[person_index] already has party_id.
update public.session_collected_payments scp
set party_id = nullif(btrim(elem->>'party_id'), '')::uuid
from public.bill_splits bs
cross join lateral jsonb_array_elements(coalesce(bs.result, '[]'::jsonb))
  with ordinality as t(elem, ord)
where scp.party_id is null
  and scp.person_index is not null
  and scp.person_index = (ord - 1)::integer
  and scp.restaurant_id = bs.restaurant_id
  and scp.session_id = bs.session_id
  and (scp.bill_split_id is null or scp.bill_split_id = bs.id)
  and bs.status in ('pending', 'confirmed', 'requested')
  and nullif(btrim(elem->>'party_id'), '') is not null;

-- ---------------------------------------------------------------------------
-- Sole SQL seat attribution (id first, else index on null-party_id rows only)
-- ---------------------------------------------------------------------------
create or replace function public.session_seat_collected(
  p_restaurant_id uuid,
  p_session_id uuid,
  p_person_index integer,
  p_party_id uuid default null
) returns numeric
language sql
stable
set search_path to public
as $$
  select coalesce(sum(amount), 0)
  from public.session_collected_payments
  where restaurant_id = p_restaurant_id
    and session_id = p_session_id
    and (
      (party_id is not null and p_party_id is not null and party_id = p_party_id)
      or (party_id is null and person_index is not distinct from p_person_index)
    );
$$;

comment on function public.session_seat_collected(uuid, uuid, integer, uuid) is
  'Sole per-seat ledger sum: payments with party_id match p_party_id; legacy null-party_id rows match person_index.';

-- Narrow legacy helper: index-only (null party_id payments). Prefer session_seat_collected.
create or replace function public.session_person_collected_by_index(
  p_restaurant_id uuid,
  p_session_id uuid,
  p_person_index integer
) returns numeric
language sql
stable
set search_path to public
as $$
  select public.session_seat_collected(
    p_restaurant_id,
    p_session_id,
    p_person_index,
    null::uuid
  );
$$;

revoke all on function public.session_seat_collected(uuid, uuid, integer, uuid) from public;
grant execute on function public.session_seat_collected(uuid, uuid, integer, uuid)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Reconcile paid stamps via session_seat_collected
-- ---------------------------------------------------------------------------
create or replace function public.reconcile_split_result_paid_from_ledger(
  p_result jsonb,
  p_restaurant_id uuid,
  p_session_id uuid,
  p_discount_rate numeric default 0
) returns jsonb
language plpgsql
stable
set search_path to public
as $$
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
  v_party uuid;
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

  v_pre_amounts := array[]::numeric[];
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
    null
  );

  for v_i in 0 .. v_len - 1 loop
    v_row := p_result -> v_i;
    v_obligation := v_obligations[v_i + 1];
    begin
      v_party := nullif(btrim(coalesce(v_row ->> 'party_id', '')), '')::uuid;
    exception
      when others then
        v_party := null;
    end;
    v_collected := public.session_seat_collected(
      p_restaurant_id,
      p_session_id,
      v_i,
      v_party
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

comment on function public.reconcile_split_result_paid_from_ledger(jsonb, uuid, uuid, numeric) is
  'Stamp result[].paid from ledger via session_seat_collected (party_id first).';

-- ---------------------------------------------------------------------------
-- confirm_bill_split_payment: p_party_id locates the seat
-- ---------------------------------------------------------------------------
drop function if exists public.confirm_bill_split_payment(
  uuid, uuid, integer, numeric, uuid, text, boolean, jsonb, uuid
);

create or replace function public.confirm_bill_split_payment(
  p_restaurant_id uuid,
  p_bill_split_id uuid,
  p_party_id uuid,
  p_collected_amount numeric default null::numeric,
  p_created_by_user_id uuid default null::uuid,
  p_payment_method text default null::text,
  p_hold_open boolean default false,
  p_payment_lines jsonb default null::jsonb,
  p_client_request_id uuid default null::uuid
) returns jsonb
language plpgsql
security definer
set search_path to public
as $function$
declare
  v_split public.bill_splits%rowtype;
  v_raw_result jsonb;
  v_base_rows jsonb;
  v_persons jsonb;
  v_next_result jsonb;
  v_row jsonb;
  v_person jsonb;
  v_all_paid boolean := true;
  v_final_amount numeric := 0;
  v_i integer;
  v_len integer;
  v_person_index integer := -1;
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
  v_party uuid;
  v_row_party uuid;
  v_stamped boolean := false;
  v_null_count integer := 0;
  v_null_idx integer := -1;
begin
  if p_party_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_party_id');
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

  if p_client_request_id is not null then
    select * into v_dup
    from public.session_collected_payments
    where restaurant_id = p_restaurant_id
      and client_request_id = p_client_request_id;
    if found then
      if v_dup.bill_split_id is distinct from p_bill_split_id
         or v_dup.party_id is distinct from p_party_id
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
        'confirmed_party_id', v_dup.party_id,
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
  v_persons := coalesce(v_split.persons, '[]'::jsonb);
  if jsonb_typeof(v_persons) <> 'array' then
    v_persons := '[]'::jsonb;
  end if;

  if jsonb_array_length(v_raw_result) = 0 then
    if coalesce(v_split.total_amount, 0) > 0 then
      v_base_rows := jsonb_build_array(
        jsonb_build_object(
          'name', 'Total',
          'amount', v_split.total_amount,
          'party_id', p_party_id::text
        )
      );
      v_stamped := true;
    else
      return jsonb_build_object('ok', false, 'code', 'empty_split');
    end if;
  else
    v_base_rows := v_raw_result;
  end if;

  v_len := jsonb_array_length(v_base_rows);

  -- Locate by party_id; if one seat has no id, stamp caller's p_party_id onto it.
  for v_i in 0 .. v_len - 1 loop
    v_row := v_base_rows -> v_i;
    begin
      v_row_party := nullif(btrim(coalesce(v_row ->> 'party_id', '')), '')::uuid;
    exception
      when others then
        v_row_party := null;
    end;
    if v_row_party = p_party_id then
      v_person_index := v_i;
      exit;
    end if;
  end loop;

  -- At most one seat without id may receive the caller's p_party_id (whole-table / legacy).
  if v_person_index < 0 then
    v_null_count := 0;
    v_null_idx := -1;
    for v_i in 0 .. v_len - 1 loop
      v_row := v_base_rows -> v_i;
      begin
        v_row_party := nullif(btrim(coalesce(v_row ->> 'party_id', '')), '')::uuid;
      exception
        when others then
          v_row_party := null;
      end;
      if v_row_party is null then
        v_null_count := v_null_count + 1;
        v_null_idx := v_i;
      end if;
    end loop;
    if v_null_count = 1 or (v_len = 1 and v_null_idx >= 0) then
      v_i := v_null_idx;
      v_base_rows := jsonb_set(
        v_base_rows,
        array[v_i::text],
        (v_base_rows -> v_i) || jsonb_build_object('party_id', p_party_id::text),
        true
      );
      if v_i < jsonb_array_length(v_persons) then
        v_persons := jsonb_set(
          v_persons,
          array[v_i::text],
          (v_persons -> v_i) || jsonb_build_object('party_id', p_party_id::text),
          true
        );
      end if;
      v_person_index := v_i;
      v_stamped := true;
    end if;
  end if;

  if v_person_index < 0 then
    return jsonb_build_object('ok', false, 'code', 'invalid_party_id');
  end if;

  if v_stamped then
    update public.bill_splits
    set result = v_base_rows,
        persons = case
          when jsonb_array_length(v_persons) > 0 then v_persons
          else persons
        end
    where id = p_bill_split_id;
  end if;

  v_pre_amounts := array[]::numeric[];
  for v_i in 0 .. v_len - 1 loop
    v_row := v_base_rows -> v_i;
    v_pre_amounts := array_append(v_pre_amounts, coalesce((v_row ->> 'amount')::numeric, 0));
  end loop;

  v_obligations := public.checkout_allocate_discounted_obligations(
    v_pre_amounts,
    v_split.discount_rate,
    v_split.total_amount,
    null
  );

  v_row := v_base_rows -> v_person_index;
  v_person_name := coalesce(v_row ->> 'name', '');
  v_obligation := v_obligations[v_person_index + 1];
  v_party := p_party_id;

  if v_split.session_id is not null then
    v_prior_collected := public.session_seat_collected(
      p_restaurant_id,
      v_split.session_id,
      v_person_index,
      v_party
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
      party_id,
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
      v_party,
      v_person_index,
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

  v_pre_amounts := array[]::numeric[];
  for v_i in 0 .. v_len - 1 loop
    v_row := v_next_result -> v_i;
    v_pre_amounts := array_append(v_pre_amounts, coalesce((v_row ->> 'amount')::numeric, 0));
  end loop;
  v_obligations := public.checkout_allocate_discounted_obligations(
    v_pre_amounts,
    v_split.discount_rate,
    v_split.total_amount,
    null
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

  v_row := v_next_result -> v_person_index;

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
    'confirmed_party_id', v_party,
    'confirmed_person_index', v_person_index,
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
  uuid, uuid, uuid, numeric, uuid, text, boolean, jsonb, uuid
) from public;
grant execute on function public.confirm_bill_split_payment(
  uuid, uuid, uuid, numeric, uuid, text, boolean, jsonb, uuid
) to authenticated, service_role;
