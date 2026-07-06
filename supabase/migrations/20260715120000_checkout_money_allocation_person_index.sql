-- Cent-exact split/discount obligations; ledger keyed by person_index.

alter table public.session_collected_payments
  add column if not exists person_index integer;

comment on column public.session_collected_payments.person_index is
  'Index into bill_splits.result[] at collection time; authoritative for reconciliation.';

create or replace function public.checkout_discount_factor(p_discount_rate numeric)
returns numeric
language sql
immutable
set search_path to public
as $$
  select 1 - greatest(0, least(100, coalesce(p_discount_rate, 0))) / 100;
$$;

create or replace function public.checkout_round_discount_amount(
  p_pre_amount numeric,
  p_discount_rate numeric
) returns numeric
language sql
immutable
set search_path to public
as $$
  select round(coalesce(p_pre_amount, 0) * public.checkout_discount_factor(p_discount_rate), 2);
$$;

create or replace function public.checkout_payable_from_total(
  p_total_amount numeric,
  p_discount_rate numeric
) returns numeric
language sql
immutable
set search_path to public
as $$
  select round(coalesce(p_total_amount, 0) * public.checkout_discount_factor(p_discount_rate), 2);
$$;

create or replace function public.session_person_collected_by_index(
  p_restaurant_id uuid,
  p_session_id uuid,
  p_person_index integer
) returns numeric
language sql
stable
set search_path to public
as $$
  select coalesce(sum(amount), 0)
  from public.session_collected_payments
  where restaurant_id = p_restaurant_id
    and session_id = p_session_id
    and person_index = p_person_index;
$$;

create or replace function public.session_total_collected(
  p_restaurant_id uuid,
  p_session_id uuid
) returns numeric
language sql
stable
set search_path to public
as $$
  select coalesce(sum(amount), 0)
  from public.session_collected_payments
  where restaurant_id = p_restaurant_id
    and session_id = p_session_id;
$$;

create or replace function public.merge_split_result_with_ledger(
  p_incoming jsonb,
  p_existing jsonb
) returns jsonb
language plpgsql
set search_path to public
as $$
declare
  v_inc jsonb := coalesce(p_incoming, '[]'::jsonb);
  v_ex jsonb := coalesce(p_existing, '[]'::jsonb);
  v_ex_len integer;
  v_i integer;
  v_ex_row jsonb;
  v_inc_row jsonb;
  v_name text;
  v_result jsonb := '[]'::jsonb;
  v_used_names jsonb := '[]'::jsonb;
  v_inc_len integer;
  v_j integer;
begin
  if jsonb_typeof(v_inc) <> 'array' then
    v_inc := '[]'::jsonb;
  end if;
  if jsonb_typeof(v_ex) <> 'array' then
    v_ex := '[]'::jsonb;
  end if;

  v_ex_len := jsonb_array_length(v_ex);
  if v_ex_len = 0 then
    return v_inc;
  end if;

  for v_i in 0 .. v_ex_len - 1 loop
    v_ex_row := v_ex -> v_i;
    v_name := btrim(coalesce(v_ex_row ->> 'name', ''));

    v_inc_row := null;
    v_inc_len := jsonb_array_length(v_inc);
    for v_j in 0 .. v_inc_len - 1 loop
      if btrim(coalesce(v_inc -> v_j ->> 'name', '')) = v_name and v_name <> '' then
        v_inc_row := v_inc -> v_j;
        exit;
      end if;
    end loop;

    if v_inc_row is null then
      v_inc_row := v_inc -> v_i;
    end if;

    if v_inc_row is not null and btrim(coalesce(v_inc_row ->> 'name', '')) = v_name then
      v_used_names := v_used_names || to_jsonb(v_name);
      v_ex_row := v_ex_row || jsonb_build_object(
        'amount', coalesce((v_inc_row ->> 'amount')::numeric, (v_ex_row ->> 'amount')::numeric),
        'paid',
          coalesce((v_ex_row ->> 'paid')::boolean, false)
          or coalesce((v_inc_row ->> 'paid')::boolean, false)
      );
    end if;

    v_result := v_result || jsonb_build_array(v_ex_row);
  end loop;

  v_inc_len := jsonb_array_length(v_inc);
  for v_j in 0 .. v_inc_len - 1 loop
    v_inc_row := v_inc -> v_j;
    v_name := btrim(coalesce(v_inc_row ->> 'name', ''));
    if v_name = '' then
      continue;
    end if;
    if exists (
      select 1
      from jsonb_array_elements_text(v_used_names) as elem
      where elem = v_name
    ) then
      continue;
    end if;
    v_result := v_result || jsonb_build_array(v_inc_row);
  end loop;

  return v_result;
end;
$$;

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

  for v_i in 0 .. v_len - 1 loop
    v_row := p_result -> v_i;
    v_obligation := public.checkout_round_discount_amount(
      coalesce((v_row ->> 'amount')::numeric, 0),
      p_discount_rate
    );
    v_collected := public.session_person_collected_by_index(
      p_restaurant_id,
      p_session_id,
      v_i
    );
    v_row := v_row || jsonb_build_object(
      'paid',
      round(v_collected, 2) >= round(v_obligation, 2)
    );
    v_result := v_result || jsonb_build_array(v_row);
  end loop;

  return v_result;
end;
$$;

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
  v_discount_rate numeric := 0;
  v_ledger_count integer := 0;
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

  select count(*)::integer
  into v_ledger_count
  from public.session_collected_payments
  where restaurant_id = p_restaurant_id
    and session_id = p_session_id;

  select *
  into v_existing
  from public.bill_splits
  where restaurant_id = p_restaurant_id
    and session_id = p_session_id
    and status in ('pending', 'confirmed', 'requested')
  order by created_at desc
  limit 1
  for update;

  if v_ledger_count > 0 and v_existing.id is not null then
    v_next_result := public.merge_split_result_with_ledger(p_result, v_existing.result);
  else
    v_next_result := public.merge_split_result_paid(p_result, v_existing.result);
  end if;

  v_discount_rate := coalesce(v_existing.discount_rate, 0);
  v_next_result := public.reconcile_split_result_paid_from_ledger(
    v_next_result,
    p_restaurant_id,
    p_session_id,
    v_discount_rate
  );

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

        if v_ledger_count > 0 then
          v_next_result := public.merge_split_result_with_ledger(p_result, v_existing.result);
        else
          v_next_result := public.merge_split_result_paid(p_result, v_existing.result);
        end if;

        v_discount_rate := coalesce(v_existing.discount_rate, 0);
        v_next_result := public.reconcile_split_result_paid_from_ledger(
          v_next_result,
          p_restaurant_id,
          p_session_id,
          v_discount_rate
        );

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

create or replace function public.confirm_bill_split_payment(
  p_restaurant_id uuid,
  p_bill_split_id uuid,
  p_person_index integer,
  p_collected_amount numeric default null,
  p_created_by_user_id uuid default null
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

  if v_split.session_id is not null then
    insert into public.session_collected_payments (
      restaurant_id,
      session_id,
      person_index,
      person_name,
      amount,
      bill_split_id,
      created_by_user_id
    ) values (
      p_restaurant_id,
      v_split.session_id,
      p_person_index,
      v_person_name,
      v_collected,
      p_bill_split_id,
      p_created_by_user_id
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
    if not coalesce((v_next_result -> v_i ->> 'paid')::boolean, false) then
      v_all_paid := false;
      exit;
    end if;
  end loop;

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
    total_amount = case when v_all_paid then v_split.total_amount else v_split.total_amount end,
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
    'row_amount', v_collected,
    'collected_payment_id', v_payment_id,
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

revoke all on function public.checkout_discount_factor(numeric) from public;
grant execute on function public.checkout_discount_factor(numeric) to authenticated, service_role;

revoke all on function public.checkout_round_discount_amount(numeric, numeric) from public;
grant execute on function public.checkout_round_discount_amount(numeric, numeric) to authenticated, service_role;

revoke all on function public.checkout_payable_from_total(numeric, numeric) from public;
grant execute on function public.checkout_payable_from_total(numeric, numeric) to authenticated, service_role;

revoke all on function public.session_person_collected_by_index(uuid, uuid, integer) from public;
grant execute on function public.session_person_collected_by_index(uuid, uuid, integer) to authenticated, service_role;

revoke all on function public.session_total_collected(uuid, uuid) from public;
grant execute on function public.session_total_collected(uuid, uuid) to authenticated, service_role;

revoke all on function public.merge_split_result_with_ledger(jsonb, jsonb) from public;
grant execute on function public.merge_split_result_with_ledger(jsonb, jsonb) to authenticated, service_role;

revoke all on function public.reconcile_split_result_paid_from_ledger(jsonb, uuid, uuid, numeric) from public;
grant execute on function public.reconcile_split_result_paid_from_ledger(jsonb, uuid, uuid, numeric) to authenticated, service_role;

revoke all on function public.upsert_bill_split_request(
  uuid, uuid, uuid, text, uuid[], text, jsonb, jsonb, numeric, text
) from public;
grant execute on function public.upsert_bill_split_request(
  uuid, uuid, uuid, text, uuid[], text, jsonb, jsonb, numeric, text
) to authenticated, service_role;

revoke all on function public.confirm_bill_split_payment(uuid, uuid, integer, numeric, uuid) from public;
grant execute on function public.confirm_bill_split_payment(uuid, uuid, integer, numeric, uuid) to authenticated, service_role;
