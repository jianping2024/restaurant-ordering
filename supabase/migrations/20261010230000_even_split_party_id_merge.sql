-- Even split: stable party_id per seat; ledger merge matches by party_id (never rename-append).
-- Also repairs active even rows where rename-append left result longer than persons.

create or replace function public.merge_even_split_result_with_ledger(
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
  v_ex_party text;
  v_inc_party text;
  v_party text;
  v_row jsonb;
  v_result jsonb := '[]'::jsonb;
  v_used boolean[];
begin
  if jsonb_typeof(v_inc) <> 'array' then
    v_inc := '[]'::jsonb;
  end if;
  if jsonb_typeof(v_ex) <> 'array' then
    v_ex := '[]'::jsonb;
  end if;

  v_ex_len := jsonb_array_length(v_ex);
  v_inc_len := jsonb_array_length(v_inc);

  if v_ex_len = 0 then
    return v_inc;
  end if;
  if v_inc_len = 0 then
    return v_ex;
  end if;

  v_used := array_fill(false, array[greatest(v_inc_len, 1)]);

  for v_i in 0 .. v_ex_len - 1 loop
    v_ex_row := v_ex -> v_i;
    v_ex_party := nullif(btrim(coalesce(v_ex_row ->> 'party_id', '')), '');
    v_inc_row := null;

    if v_ex_party is not null then
      for v_j in 0 .. v_inc_len - 1 loop
        if v_used[v_j + 1] then
          continue;
        end if;
        v_inc_party := nullif(btrim(coalesce(v_inc -> v_j ->> 'party_id', '')), '');
        if v_inc_party is not null and lower(v_inc_party) = lower(v_ex_party) then
          v_inc_row := v_inc -> v_j;
          v_used[v_j + 1] := true;
          exit;
        end if;
      end loop;
    end if;

    -- Legacy seats without party_id: align by index once.
    if v_inc_row is null and v_i < v_inc_len and not coalesce(v_used[v_i + 1], false) then
      v_inc_row := v_inc -> v_i;
      v_used[v_i + 1] := true;
    end if;

    if v_inc_row is null then
      -- Keep existing seat; stamp party_id if missing.
      v_party := coalesce(v_ex_party, gen_random_uuid()::text);
      v_row := v_ex_row || jsonb_build_object('party_id', v_party);
      v_result := v_result || jsonb_build_array(v_row);
      continue;
    end if;

    v_party := coalesce(
      nullif(btrim(coalesce(v_inc_row ->> 'party_id', '')), ''),
      v_ex_party,
      gen_random_uuid()::text
    );

    v_row := v_ex_row || jsonb_build_object(
      'name', coalesce(nullif(btrim(coalesce(v_inc_row ->> 'name', '')), ''), v_ex_row ->> 'name'),
      'amount', coalesce((v_inc_row ->> 'amount')::numeric, (v_ex_row ->> 'amount')::numeric),
      'paid',
        coalesce((v_ex_row ->> 'paid')::boolean, false)
        or coalesce((v_inc_row ->> 'paid')::boolean, false),
      'party_id', v_party
    );
    v_result := v_result || jsonb_build_array(v_row);
  end loop;

  -- Never append unmatched incoming names (that was the rename-append bug).
  return v_result;
end;
$$;

revoke all on function public.merge_even_split_result_with_ledger(jsonb, jsonb) from public;
grant execute on function public.merge_even_split_result_with_ledger(jsonb, jsonb)
  to authenticated, service_role;

-- Align persons to result seats (same length + party_id).
create or replace function public.sync_even_persons_to_result(
  p_persons jsonb,
  p_result jsonb
) returns jsonb
language plpgsql
set search_path to public
as $$
declare
  v_result jsonb := coalesce(p_result, '[]'::jsonb);
  v_persons jsonb := coalesce(p_persons, '[]'::jsonb);
  v_out jsonb := '[]'::jsonb;
  v_len integer;
  v_i integer;
  v_row jsonb;
  v_name text;
  v_party text;
begin
  if jsonb_typeof(v_result) <> 'array' then
    return '[]'::jsonb;
  end if;
  v_len := jsonb_array_length(v_result);
  for v_i in 0 .. v_len - 1 loop
    v_row := v_result -> v_i;
    v_name := btrim(coalesce(v_row ->> 'name', ''));
    if v_name = '' then
      v_name := btrim(coalesce(v_persons -> v_i ->> 'name', ''));
    end if;
    v_party := nullif(btrim(coalesce(v_row ->> 'party_id', '')), '');
    if v_party is null then
      v_party := nullif(btrim(coalesce(v_persons -> v_i ->> 'party_id', '')), '');
    end if;
    if v_party is null then
      v_party := gen_random_uuid()::text;
    end if;
    v_out := v_out || jsonb_build_array(
      jsonb_build_object('name', v_name, 'party_id', v_party)
    );
  end loop;
  return v_out;
end;
$$;

revoke all on function public.sync_even_persons_to_result(jsonb, jsonb) from public;
grant execute on function public.sync_even_persons_to_result(jsonb, jsonb)
  to authenticated, service_role;

-- Repair active even splits bloated by name-based merge (result longer than persons).
do $$
declare
  r record;
  v_persons jsonb;
  v_result jsonb;
  v_next jsonb;
  v_i integer;
  v_p jsonb;
  v_match jsonb;
  v_j integer;
  v_name text;
  v_party text;
  v_amount numeric;
  v_paid boolean;
begin
  for r in
    select id, persons, result, total_amount
    from public.bill_splits
    where split_mode = 'even'
      and status in ('pending', 'confirmed', 'requested')
      and jsonb_array_length(coalesce(persons, '[]'::jsonb)) > 0
      and jsonb_array_length(coalesce(result, '[]'::jsonb))
        > jsonb_array_length(coalesce(persons, '[]'::jsonb))
  loop
    v_persons := coalesce(r.persons, '[]'::jsonb);
    v_result := coalesce(r.result, '[]'::jsonb);
    v_next := '[]'::jsonb;

    for v_i in 0 .. jsonb_array_length(v_persons) - 1 loop
      v_p := v_persons -> v_i;
      v_name := btrim(coalesce(v_p ->> 'name', ''));
      v_party := nullif(btrim(coalesce(v_p ->> 'party_id', '')), '');
      v_match := null;

      if v_party is not null then
        for v_j in 0 .. jsonb_array_length(v_result) - 1 loop
          if lower(btrim(coalesce(v_result -> v_j ->> 'party_id', ''))) = lower(v_party) then
            v_match := v_result -> v_j;
            exit;
          end if;
        end loop;
      end if;

      if v_match is null and v_name <> '' then
        for v_j in 0 .. jsonb_array_length(v_result) - 1 loop
          if lower(btrim(coalesce(v_result -> v_j ->> 'name', ''))) = lower(v_name) then
            v_match := v_result -> v_j;
            exit;
          end if;
        end loop;
      end if;

      if v_match is null and v_i < jsonb_array_length(v_result) then
        v_match := v_result -> v_i;
      end if;

      v_amount := coalesce((v_match ->> 'amount')::numeric, 0);
      v_paid := coalesce((v_match ->> 'paid')::boolean, false);
      v_party := coalesce(
        v_party,
        nullif(btrim(coalesce(v_match ->> 'party_id', '')), ''),
        gen_random_uuid()::text
      );
      if v_name = '' then
        v_name := coalesce(nullif(btrim(coalesce(v_match ->> 'name', '')), ''), 'Guest');
      end if;

      v_next := v_next || jsonb_build_array(
        jsonb_build_object(
          'name', v_name,
          'amount', v_amount,
          'paid', v_paid,
          'party_id', v_party
        )
      );
      v_persons := jsonb_set(
        v_persons,
        array[v_i::text],
        jsonb_build_object('name', v_name, 'party_id', v_party)
      );
    end loop;

    update public.bill_splits
    set persons = v_persons,
        result = v_next
    where id = r.id;
  end loop;
end;
$$;

CREATE OR REPLACE FUNCTION public.upsert_bill_split_request(p_restaurant_id uuid, p_session_id uuid, p_table_id uuid, p_display_name text, p_order_ids uuid[], p_split_mode text, p_persons jsonb, p_result jsonb, p_total_amount numeric, p_customer_nif text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare
  v_session public.table_sessions%rowtype;
  v_existing public.bill_splits%rowtype;
  v_next_result jsonb;
  v_next_persons jsonb;
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
    -- Even: compare against authoritative (persons-preferring) length after prior repair.
    v_existing_len := case
      when v_split_mode = 'even'
        and jsonb_array_length(coalesce(v_existing.persons, '[]'::jsonb)) > 0
        and jsonb_array_length(coalesce(v_existing.persons, '[]'::jsonb))
          <> jsonb_array_length(coalesce(v_existing.result, '[]'::jsonb))
      then jsonb_array_length(coalesce(v_existing.persons, '[]'::jsonb))
      else jsonb_array_length(coalesce(v_existing.result, '[]'::jsonb))
    end;
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
    elsif v_split_mode = 'even' then
      v_next_result := public.merge_even_split_result_with_ledger(p_result, v_existing.result);
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

  v_next_persons := coalesce(p_persons, '[]'::jsonb);
  if p_split_mode = 'even' then
    v_next_persons := public.sync_even_persons_to_result(v_next_persons, v_next_result);
    -- Ensure every result seat has party_id (stamp from synced persons).
    v_next_result := (
      select coalesce(jsonb_agg(
        (v_next_result -> (ord - 1)) || jsonb_build_object(
          'party_id', coalesce(
            nullif(btrim(coalesce(v_next_result -> (ord - 1) ->> 'party_id', '')), ''),
            v_next_persons -> (ord - 1) ->> 'party_id'
          )
        )
      ), '[]'::jsonb)
      from generate_series(1, jsonb_array_length(v_next_result)) as ord
    );
  end if;

  if v_existing.id is not null then
    update public.bill_splits
    set
      table_id = p_table_id,
      display_name = p_display_name,
      order_ids = coalesce(p_order_ids, '{}'::uuid[]),
      split_mode = p_split_mode,
      persons = v_next_persons,
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
        v_next_persons,
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
          v_existing_len := case
            when v_split_mode = 'even'
              and jsonb_array_length(coalesce(v_existing.persons, '[]'::jsonb)) > 0
              and jsonb_array_length(coalesce(v_existing.persons, '[]'::jsonb))
                <> jsonb_array_length(coalesce(v_existing.result, '[]'::jsonb))
            then jsonb_array_length(coalesce(v_existing.persons, '[]'::jsonb))
            else jsonb_array_length(coalesce(v_existing.result, '[]'::jsonb))
          end;
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
          elsif v_split_mode = 'even' then
            v_next_result := public.merge_even_split_result_with_ledger(p_result, v_existing.result);
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

        v_next_persons := coalesce(p_persons, '[]'::jsonb);
        if p_split_mode = 'even' then
          v_next_persons := public.sync_even_persons_to_result(v_next_persons, v_next_result);
          v_next_result := (
            select coalesce(jsonb_agg(
              (v_next_result -> (ord - 1)) || jsonb_build_object(
                'party_id', coalesce(
                  nullif(btrim(coalesce(v_next_result -> (ord - 1) ->> 'party_id', '')), ''),
                  v_next_persons -> (ord - 1) ->> 'party_id'
                )
              )
            ), '[]'::jsonb)
            from generate_series(1, jsonb_array_length(v_next_result)) as ord
          );
        end if;

        update public.bill_splits
        set
          table_id = p_table_id,
          display_name = p_display_name,
          order_ids = coalesce(p_order_ids, '{}'::uuid[]),
          split_mode = p_split_mode,
          persons = v_next_persons,
          result = v_next_result,
          total_amount = p_total_amount,
          customer_nif = v_customer_nif,
          status = 'requested'
        where id = v_existing.id;

        v_bill_split_id := v_existing.id;
    end;
  end if;

  if p_split_mode in ('whole_table', 'even') then
    update public.table_sessions
    set status = 'billing'
    where id = p_session_id
      and status = 'open';
  end if;

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
