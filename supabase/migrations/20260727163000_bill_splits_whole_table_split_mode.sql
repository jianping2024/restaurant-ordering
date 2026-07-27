-- whole_table split mode: explicit checkout intent for full-table payment.
-- Backfill legacy single-payer rows; normalize RPC writes; staff settled close uses whole_table.

alter table public.bill_splits drop constraint if exists bill_splits_split_mode_check;
alter table public.bill_splits add constraint bill_splits_split_mode_check
  check (split_mode in ('whole_table', 'even', 'by_item', 'custom'));

update public.bill_splits
set
  split_mode = 'whole_table',
  persons = jsonb_build_array(jsonb_build_object('name', '__whole_table__')),
  result = (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'name', '__whole_table__',
        'amount', (elem->>'amount')::numeric,
        'paid', coalesce((elem->>'paid')::boolean, false)
      )
    ), '[]'::jsonb)
    from jsonb_array_elements(bill_splits.result) as elem
  )
where jsonb_array_length(coalesce(result, '[]'::jsonb)) = 1
  and (
    lower(btrim(coalesce(result->0->>'name', ''))) in ('total', '总计', '__whole_table__', '整桌')
    or (split_mode = 'custom' and lower(btrim(coalesce(result->0->>'name', ''))) = 'guest 1')
  );

update public.session_collected_payments
set person_name = '__whole_table__'
where lower(btrim(person_name)) in ('total', '总计', '__whole_table__', '整桌');


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
  v_existing_len integer := 0;
  v_incoming_len integer := 0;
  v_split_mode text;
begin
  if p_session_id is null or p_table_id is null or p_display_name is null or btrim(p_display_name) = '' then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;

  v_customer_nif := nullif(btrim(coalesce(p_customer_nif, '')), '');

  -- Normalize legacy whole-table payloads and validate mode shape.
  if p_split_mode = 'custom'
    and jsonb_array_length(coalesce(p_result, '[]'::jsonb)) = 1
    and lower(btrim(coalesce(p_result->0->>'name', ''))) in (
      'total', '总计', '__whole_table__', '整桌', 'guest 1'
    )
  then
    p_split_mode := 'whole_table';
  end if;

  if p_split_mode = 'whole_table' then
    p_persons := jsonb_build_array(jsonb_build_object('name', '__whole_table__'));
    p_result := jsonb_build_array(
      jsonb_build_object(
        'name', '__whole_table__',
        'amount', coalesce((p_result->0->>'amount')::numeric, p_total_amount),
        'paid', coalesce((p_result->0->>'paid')::boolean, false)
      )
    );
  end if;

  if p_split_mode not in ('whole_table', 'even', 'by_item', 'custom') then
    return jsonb_build_object('ok', false, 'code', 'invalid_split');
  end if;

  if p_split_mode = 'whole_table'
    and jsonb_array_length(coalesce(p_result, '[]'::jsonb)) <> 1
  then
    return jsonb_build_object('ok', false, 'code', 'invalid_split');
  end if;

  if p_split_mode = 'custom'
    and jsonb_array_length(coalesce(p_result, '[]'::jsonb)) < 2
  then
    return jsonb_build_object('ok', false, 'code', 'invalid_split');
  end if;


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
    v_split_mode := coalesce(v_existing.split_mode, p_split_mode);
    v_existing_len := jsonb_array_length(coalesce(v_existing.result, '[]'::jsonb));
    v_incoming_len := jsonb_array_length(coalesce(p_result, '[]'::jsonb));
    if v_existing_len > 0
      and v_incoming_len > 0
      and v_incoming_len <> v_existing_len
      and v_split_mode in ('even', 'custom', 'whole_table')
    then
      return jsonb_build_object('ok', false, 'code', 'split_shape_locked');
    end if;

    if v_split_mode = 'by_item' then
      v_next_result := public.merge_by_item_split_result_with_ledger(p_result, v_existing.result);
    else
      v_next_result := public.merge_split_result_with_ledger(p_result, v_existing.result);
    end if;
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
          v_split_mode := coalesce(v_existing.split_mode, p_split_mode);
          v_existing_len := jsonb_array_length(coalesce(v_existing.result, '[]'::jsonb));
          v_incoming_len := jsonb_array_length(coalesce(p_result, '[]'::jsonb));
          if v_existing_len > 0
            and v_incoming_len > 0
            and v_incoming_len <> v_existing_len
            and v_split_mode in ('even', 'custom', 'whole_table')
          then
            return jsonb_build_object('ok', false, 'code', 'split_shape_locked');
          end if;

          if v_split_mode = 'by_item' then
            v_next_result := public.merge_by_item_split_result_with_ledger(p_result, v_existing.result);
          else
            v_next_result := public.merge_split_result_with_ledger(p_result, v_existing.result);
          end if;
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
    and status = 'open';

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
        jsonb_build_object('name', '__whole_table__', 'amount', v_split.total_amount)
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

revoke all on function public.confirm_bill_split_payment(uuid, uuid, integer, numeric, uuid) from public;
grant execute on function public.confirm_bill_split_payment(uuid, uuid, integer, numeric, uuid) to authenticated, service_role;

create or replace function public.close_table_session_settled(
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
  v_gap jsonb;
  v_payable numeric := 0;
  v_has_paid_split boolean := false;
  v_display_name text;
  v_order_ids uuid[];
  v_bill_split_id uuid;
  v_result jsonb;
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

  -- Same as operational: absorb abandoned / in-progress unpaid splits.
  update public.bill_splits
  set status = 'cancelled'
  where restaurant_id = p_restaurant_id
    and session_id = v_session.id
    and status in ('pending', 'confirmed', 'requested');

  v_gap := public.compute_session_payment_gap(p_restaurant_id, v_session.id);
  v_payable := coalesce((v_gap->>'payable_amount')::numeric, 0);

  select exists (
    select 1
    from public.bill_splits
    where restaurant_id = p_restaurant_id
      and session_id = v_session.id
      and status = 'paid'
  )
  into v_has_paid_split;

  if not v_has_paid_split and v_payable > 0.0001 then
    select display_name
    into v_display_name
    from public.get_active_restaurant_table(p_restaurant_id, p_table_id);

    if v_display_name is null then
      return jsonb_build_object('ok', false, 'code', 'update_failed', 'message', 'invalid_table');
    end if;

    select coalesce(array_agg(id order by created_at), '{}'::uuid[])
    into v_order_ids
    from public.orders
    where restaurant_id = p_restaurant_id
      and session_id = v_session.id
      and status in ('pending', 'cooking', 'done');

    v_result := jsonb_build_array(
      jsonb_build_object(
        'name', '__whole_table__',
        'amount', round(v_payable, 2),
        'paid', true
      )
    );

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
      status,
      discount_rate
    ) values (
      p_restaurant_id,
      v_session.id,
      p_table_id,
      v_display_name,
      coalesce(v_order_ids, '{}'::uuid[]),
      'whole_table',
      jsonb_build_array(jsonb_build_object('name', '__whole_table__')),
      v_result,
      round(v_payable, 2),
      'paid',
      0
    )
    returning id into v_bill_split_id;

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
      v_session.id,
      0,
      '__whole_table__',
      round(v_payable, 2),
      v_bill_split_id,
      p_closed_by_user_id
    );
  end if;

  update public.table_sessions
  set
    status = 'closed',
    closed_at = v_now,
    closed_reason = p_closed_reason,
    closed_by_user_id = p_closed_by_user_id
  where id = v_session.id;

  return jsonb_build_object(
    'ok', true,
    'session_id', v_session.id,
    'payable_amount', round(v_payable, 2)
  );
exception
  when others then
    return jsonb_build_object(
      'ok', false,
      'code', 'update_failed',
      'message', sqlerrm
    );
end;
$$;

revoke all on function public.close_table_session_settled(uuid, uuid, text, uuid) from public;
grant execute on function public.close_table_session_settled(uuid, uuid, text, uuid)
  to authenticated, service_role;
