-- By-item continuation: incoming split obligations are authoritative after
-- reallocation. Case-insensitive person matching for all ledger merges.

create or replace function public.merge_by_item_split_result_with_ledger(
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
  v_inc_len integer;
  v_i integer;
  v_j integer;
  v_ex_row jsonb;
  v_inc_row jsonb;
  v_name text;
  v_key text;
  v_result jsonb := '[]'::jsonb;
  v_used_keys jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(v_inc) <> 'array' then
    v_inc := '[]'::jsonb;
  end if;
  if jsonb_typeof(v_ex) <> 'array' then
    v_ex := '[]'::jsonb;
  end if;

  v_ex_len := jsonb_array_length(v_ex);
  v_inc_len := jsonb_array_length(v_inc);

  if v_inc_len = 0 then
    return v_ex;
  end if;
  if v_ex_len = 0 then
    return v_inc;
  end if;

  for v_i in 0 .. v_ex_len - 1 loop
    v_ex_row := v_ex -> v_i;
    v_name := btrim(coalesce(v_ex_row ->> 'name', ''));
    v_key := lower(v_name);
    if v_key = '' then
      continue;
    end if;

    v_inc_row := null;
    for v_j in 0 .. v_inc_len - 1 loop
      if lower(btrim(coalesce(v_inc -> v_j ->> 'name', ''))) = v_key then
        v_inc_row := v_inc -> v_j;
        exit;
      end if;
    end loop;

    if v_inc_row is null then
      continue;
    end if;

    v_used_keys := v_used_keys || to_jsonb(v_key);
    v_result := v_result || jsonb_build_array(
      v_ex_row || jsonb_build_object(
        'amount', (v_inc_row ->> 'amount')::numeric,
        'paid',
          coalesce((v_ex_row ->> 'paid')::boolean, false)
          or coalesce((v_inc_row ->> 'paid')::boolean, false)
      )
    );
  end loop;

  for v_j in 0 .. v_inc_len - 1 loop
    v_inc_row := v_inc -> v_j;
    v_key := lower(btrim(coalesce(v_inc_row ->> 'name', '')));
    if v_key = '' then
      continue;
    end if;
    if exists (
      select 1
      from jsonb_array_elements_text(v_used_keys) as elem
      where elem = v_key
    ) then
      continue;
    end if;
    v_used_keys := v_used_keys || to_jsonb(v_key);
    v_result := v_result || jsonb_build_array(v_inc_row);
  end loop;

  return v_result;
end;
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
  v_key text;
  v_result jsonb := '[]'::jsonb;
  v_used_keys jsonb := '[]'::jsonb;
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
    v_key := lower(v_name);

    v_inc_row := null;
    v_inc_len := jsonb_array_length(v_inc);
    for v_j in 0 .. v_inc_len - 1 loop
      if lower(btrim(coalesce(v_inc -> v_j ->> 'name', ''))) = v_key and v_key <> '' then
        v_inc_row := v_inc -> v_j;
        exit;
      end if;
    end loop;

    if v_inc_row is null then
      v_inc_row := v_inc -> v_i;
    end if;

    if v_inc_row is not null
      and lower(btrim(coalesce(v_inc_row ->> 'name', ''))) = v_key
      and v_key <> ''
    then
      v_used_keys := v_used_keys || to_jsonb(v_key);
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
    v_key := lower(btrim(coalesce(v_inc_row ->> 'name', '')));
    if v_key = '' then
      continue;
    end if;
    if exists (
      select 1
      from jsonb_array_elements_text(v_used_keys) as elem
      where elem = v_key
    ) then
      continue;
    end if;
    v_result := v_result || jsonb_build_array(v_inc_row);
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
  v_existing_len integer := 0;
  v_incoming_len integer := 0;
  v_split_mode text;
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
    v_split_mode := coalesce(v_existing.split_mode, p_split_mode);
    v_existing_len := jsonb_array_length(coalesce(v_existing.result, '[]'::jsonb));
    v_incoming_len := jsonb_array_length(coalesce(p_result, '[]'::jsonb));
    if v_existing_len > 0
      and v_incoming_len > 0
      and v_incoming_len <> v_existing_len
      and v_split_mode in ('even', 'custom')
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
            and v_split_mode in ('even', 'custom')
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

revoke all on function public.merge_by_item_split_result_with_ledger(jsonb, jsonb) from public;
grant execute on function public.merge_by_item_split_result_with_ledger(jsonb, jsonb) to authenticated, service_role;

revoke all on function public.merge_split_result_with_ledger(jsonb, jsonb) from public;
grant execute on function public.merge_split_result_with_ledger(jsonb, jsonb) to authenticated, service_role;

revoke all on function public.upsert_bill_split_request(uuid, uuid, uuid, text, uuid[], text, jsonb, jsonb, numeric, text) from public;
grant execute on function public.upsert_bill_split_request(uuid, uuid, uuid, text, uuid[], text, jsonb, jsonb, numeric, text)
  to authenticated, service_role;
