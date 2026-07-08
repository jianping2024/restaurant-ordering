-- A: atomic checkout request upsert (no duplicate active bill_splits per session)
-- B: atomic operational close with bill_splits + session locking (matches confirm-payment order)

create unique index if not exists idx_bill_splits_one_active_per_session
  on public.bill_splits (session_id)
  where session_id is not null
    and status in ('pending', 'confirmed', 'requested');
create or replace function public.void_all_line_items_for_forced_close(p_items jsonb)
returns jsonb
language plpgsql
set search_path to public
as $$
declare
  v_now text := to_char(timezone('utc', now()), 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
  v_after_buffet jsonb;
begin
  v_after_buffet := public.void_active_buffet_lines_in_items(coalesce(p_items, '[]'::jsonb));
  return coalesce((
    select jsonb_agg(
      case
        when coalesce(elem->>'kind', '') <> 'buffet_base'
             and coalesce(elem->>'item_status', 'pending') <> 'voided'
        then elem || jsonb_build_object('item_status', 'voided', 'voided_at', v_now)
        else elem
      end
    )
    from jsonb_array_elements(v_after_buffet) as elem
  ), '[]'::jsonb);
end;
$$;
create or replace function public.merge_split_result_paid(p_incoming jsonb, p_existing jsonb)
returns jsonb
language plpgsql
set search_path to public
as $$
declare
  v_inc_len integer;
  v_ex_len integer;
  v_len integer;
  v_i integer;
  v_inc jsonb;
  v_ex jsonb;
  v_row jsonb;
  v_result jsonb := '[]'::jsonb;
begin
  p_incoming := coalesce(p_incoming, '[]'::jsonb);
  p_existing := coalesce(p_existing, '[]'::jsonb);

  if jsonb_typeof(p_incoming) <> 'array' then
    p_incoming := '[]'::jsonb;
  end if;
  if jsonb_typeof(p_existing) <> 'array' then
    p_existing := '[]'::jsonb;
  end if;

  v_inc_len := jsonb_array_length(p_incoming);
  v_ex_len := jsonb_array_length(p_existing);

  if v_ex_len = 0 then
    return p_incoming;
  end if;
  if v_inc_len = 0 then
    return p_existing;
  end if;

  v_len := greatest(v_inc_len, v_ex_len);
  for v_i in 0 .. v_len - 1 loop
    v_inc := p_incoming -> v_i;
    v_ex := p_existing -> v_i;
    if v_inc is null and v_ex is null then
      continue;
    end if;
    v_row := coalesce(v_inc, v_ex);
    if v_ex is not null then
      v_row := v_row || jsonb_build_object(
        'paid',
        coalesce((v_row->>'paid')::boolean, false)
          or coalesce((v_ex->>'paid')::boolean, false)
      );
    end if;
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
  p_total_amount numeric
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
begin
  if p_session_id is null or p_table_id is null or p_display_name is null or btrim(p_display_name) = '' then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
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
create or replace function public.close_table_session_operational(
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
  v_order record;
  v_now timestamptz := now();
  v_new_items jsonb;
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

  update public.bill_splits
  set status = 'cancelled'
  where restaurant_id = p_restaurant_id
    and session_id = v_session.id
    and status in ('pending', 'confirmed', 'requested');

  for v_order in
    select id, items
    from public.orders
    where restaurant_id = p_restaurant_id
      and session_id = v_session.id
      and status in ('pending', 'cooking', 'done')
  loop
    v_new_items := public.void_all_line_items_for_forced_close(v_order.items);
    update public.orders
    set
      items = v_new_items,
      status = 'done',
      total_amount = 0,
      updated_at = v_now
    where id = v_order.id
      and restaurant_id = p_restaurant_id;
  end loop;

  update public.table_sessions
  set
    status = 'closed',
    closed_at = v_now,
    closed_reason = p_closed_reason,
    closed_by_user_id = p_closed_by_user_id
  where id = v_session.id;

  return jsonb_build_object('ok', true, 'session_id', v_session.id);
exception
  when others then
    return jsonb_build_object(
      'ok', false,
      'code', 'update_failed',
      'message', sqlerrm
    );
end;
$$;
create or replace function public.confirm_bill_split_payment(
  p_restaurant_id uuid,
  p_bill_split_id uuid,
  p_person_index integer,
  p_discount_rate numeric default 0
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

  v_rate := greatest(0, least(100, coalesce(p_discount_rate, 0)));
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
revoke all on function public.upsert_bill_split_request(
  uuid, uuid, uuid, text, uuid[], text, jsonb, jsonb, numeric
) from public;
grant execute on function public.upsert_bill_split_request(
  uuid, uuid, uuid, text, uuid[], text, jsonb, jsonb, numeric
) to authenticated, service_role;
revoke all on function public.close_table_session_operational(
  uuid, uuid, text, uuid
) from public;
grant execute on function public.close_table_session_operational(
  uuid, uuid, text, uuid
) to authenticated, service_role;
