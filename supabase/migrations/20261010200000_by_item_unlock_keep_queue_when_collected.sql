-- By-item 恢复点单 (unlock) with collections: only the current ticket is removed.
-- Follow-up to 20261010190000: clear staff_checkout_requested_at only when no called-unpaid
-- ticket remains AND the session has no collected payment. With a collection the table stays in
-- the checkout queue so staff can keep collecting the remaining dishes.

create or replace function public.individual_checkout_apply(
  p_restaurant_id uuid,
  p_session_id uuid,
  p_table_id uuid,
  p_display_name text,
  p_order_ids uuid[],
  p_action text,
  p_actor text,
  p_client_id uuid,
  p_party_keys text[],
  p_base_revision integer,
  p_persons jsonb,
  p_result jsonb,
  p_total_amount numeric,
  p_ticket_signal_items jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path to public
as $$
declare
  v_session public.table_sessions%rowtype;
  v_existing public.bill_splits%rowtype;
  v_split_id uuid;
  v_persons jsonb := coalesce(p_persons, '[]'::jsonb);
  v_result jsonb := coalesce(p_result, '[]'::jsonb);
  v_old_persons jsonb;
  v_old_result jsonb;
  v_old_others jsonb;
  v_new_others jsonb;
  v_key text;
  v_i integer;
  v_len integer;
  v_old_row jsonb;
  v_new_row jsonb;
  v_old_person jsonb;
  v_new_person jsonb;
  v_found boolean;
  v_call public.bill_split_ticket_calls%rowtype;
  v_call_found boolean;
  v_name text;
  v_items jsonb;
  v_revision integer;
  v_status text;
  v_idx integer;
begin
  if p_action not in ('call', 'unlock')
    or p_actor not in ('guest', 'staff')
    or coalesce(cardinality(p_party_keys), 0) = 0
    or p_session_id is null
    or p_table_id is null
    or p_display_name is null or btrim(p_display_name) = ''
    or (p_action = 'call' and p_actor <> 'guest')
    or (p_actor = 'guest' and p_client_id is null)
  then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;

  select * into v_session
  from public.table_sessions
  where id = p_session_id
    and restaurant_id = p_restaurant_id
    and table_id = p_table_id
    and status in ('open', 'billing');
  if not found then
    return jsonb_build_object('ok', false, 'code', 'no_active_session');
  end if;

  perform pg_advisory_xact_lock(hashtext(p_session_id::text));
  perform set_config('mesa.individual_action', '1', true);

  select * into v_existing
  from public.bill_splits
  where restaurant_id = p_restaurant_id
    and session_id = p_session_id
    and status in ('pending', 'confirmed', 'requested')
  order by created_at desc
  limit 1
  for update;

  if v_existing.id is null then
    if p_action = 'unlock' then
      return jsonb_build_object('ok', false, 'code', 'ticket_not_found');
    end if;
    if p_base_revision is not null then
      return jsonb_build_object('ok', false, 'code', 'stale_plan');
    end if;
    v_old_persons := '[]'::jsonb;
    v_old_result := '[]'::jsonb;
  else
    if p_base_revision is distinct from v_existing.revision then
      return jsonb_build_object('ok', false, 'code', 'stale_plan');
    end if;
    if v_existing.split_mode <> 'by_item' then
      return jsonb_build_object('ok', false, 'code', 'split_mode_locked');
    end if;
    v_old_persons := coalesce(v_existing.persons, '[]'::jsonb);
    v_old_result := coalesce(v_existing.result, '[]'::jsonb);
  end if;

  if p_action = 'unlock' then
    -- Unlock deletes the ticket server-side: start from the stored plan, never client rows.
    v_persons := v_old_persons;
    v_result := v_old_result;
  end if;

  -- Tickets outside this action must be untouched (result + persons).
  select coalesce(jsonb_agg(r.row order by r.ord), '[]'::jsonb) into v_old_others
  from jsonb_array_elements(v_old_result) with ordinality as r(row, ord)
  where not (public.individual_ticket_key(r.row) = any (p_party_keys));
  select coalesce(jsonb_agg(r.row order by r.ord), '[]'::jsonb) into v_new_others
  from jsonb_array_elements(v_result) with ordinality as r(row, ord)
  where not (public.individual_ticket_key(r.row) = any (p_party_keys));
  if v_old_others is distinct from v_new_others then
    return jsonb_build_object('ok', false, 'code', 'locked_ticket_changed');
  end if;

  select coalesce(jsonb_agg(r.row order by r.ord), '[]'::jsonb) into v_old_others
  from jsonb_array_elements(v_old_persons) with ordinality as r(row, ord)
  where not (public.individual_ticket_key(r.row) = any (p_party_keys));
  select coalesce(jsonb_agg(r.row order by r.ord), '[]'::jsonb) into v_new_others
  from jsonb_array_elements(v_persons) with ordinality as r(row, ord)
  where not (public.individual_ticket_key(r.row) = any (p_party_keys));
  if v_old_others is distinct from v_new_others then
    return jsonb_build_object('ok', false, 'code', 'locked_ticket_changed');
  end if;

  foreach v_key in array p_party_keys loop
    v_found := false;
    v_old_row := null;
    v_len := jsonb_array_length(v_old_result);
    for v_i in 0 .. v_len - 1 loop
      if public.individual_ticket_key(v_old_result -> v_i) = v_key then
        v_found := true;
        v_old_row := v_old_result -> v_i;
        if coalesce((v_old_row ->> 'paid')::boolean, false) then
          return jsonb_build_object('ok', false, 'code', 'ticket_paid');
        end if;
        if public.session_person_collected_by_index(p_restaurant_id, p_session_id, v_i) > 0 then
          return jsonb_build_object('ok', false, 'code', 'ticket_collecting');
        end if;
        exit;
      end if;
    end loop;

    select * into v_call
    from public.bill_split_ticket_calls
    where bill_split_id = v_existing.id and ticket_key = v_key;
    v_call_found := found;

    select r.row into v_new_row
    from jsonb_array_elements(v_result) as r(row)
    where public.individual_ticket_key(r.row) = v_key
    limit 1;
    select r.row into v_new_person
    from jsonb_array_elements(v_persons) as r(row)
    where public.individual_ticket_key(r.row) = v_key
    limit 1;

    if p_action = 'call' then
      if v_new_row is null or v_new_person is null
        or coalesce((v_new_row ->> 'amount')::numeric, 0) <= 0
        or jsonb_array_length(coalesce(v_new_person -> 'item_shares', '[]'::jsonb)) = 0
      then
        return jsonb_build_object('ok', false, 'code', 'empty_ticket');
      end if;
      if v_found then
        if not v_call_found or v_call.client_id is distinct from p_client_id then
          return jsonb_build_object('ok', false, 'code', 'ticket_locked');
        end if;
        if v_call.state = 'called' then
          select r.row into v_old_person
          from jsonb_array_elements(v_old_persons) as r(row)
          where public.individual_ticket_key(r.row) = v_key
          limit 1;
          if v_new_row is distinct from v_old_row or v_new_person is distinct from v_old_person then
            return jsonb_build_object('ok', false, 'code', 'ticket_locked');
          end if;
        end if;
      end if;
    else
      if not v_found then
        return jsonb_build_object('ok', false, 'code', 'ticket_not_found');
      end if;
      if p_actor = 'guest'
        and (not v_call_found or v_call.client_id is distinct from p_client_id)
      then
        return jsonb_build_object('ok', false, 'code', 'not_your_ticket');
      end if;
      if not v_call_found then
        return jsonb_build_object('ok', false, 'code', 'ticket_not_found');
      end if;
    end if;
  end loop;

  if p_action = 'unlock' then
    -- Sole unlock write: drop each unpaid ticket from persons + result, then close the gap in
    -- the collected-payment ledger (keyed by result index) in this same transaction.
    foreach v_key in array p_party_keys loop
      v_idx := -1;
      for v_i in 0 .. jsonb_array_length(v_result) - 1 loop
        if public.individual_ticket_key(v_result -> v_i) = v_key then
          v_idx := v_i;
          exit;
        end if;
      end loop;
      if v_idx >= 0 then
        select coalesce(jsonb_agg(r.row order by r.ord), '[]'::jsonb) into v_result
        from jsonb_array_elements(v_result) with ordinality as r(row, ord)
        where r.ord <> v_idx + 1;
        update public.session_collected_payments
        set person_index = person_index - 1
        where restaurant_id = p_restaurant_id
          and session_id = p_session_id
          and person_index > v_idx;
      end if;
      select coalesce(jsonb_agg(r.row order by r.ord), '[]'::jsonb) into v_persons
      from jsonb_array_elements(v_persons) with ordinality as r(row, ord)
      where public.individual_ticket_key(r.row) <> v_key;
    end loop;
  end if;

  if v_existing.id is null then
    begin
      insert into public.bill_splits (
        restaurant_id, session_id, table_id, display_name, order_ids,
        split_mode, persons, result, total_amount, status
      ) values (
        p_restaurant_id, p_session_id, p_table_id, p_display_name,
        coalesce(p_order_ids, '{}'::uuid[]),
        'by_item', v_persons, v_result, p_total_amount, 'confirmed'
      )
      returning id into v_split_id;
    exception
      when unique_violation then
        return jsonb_build_object('ok', false, 'code', 'stale_plan');
    end;
  else
    update public.bill_splits
    set table_id = p_table_id,
        display_name = p_display_name,
        order_ids = coalesce(p_order_ids, '{}'::uuid[]),
        split_mode = 'by_item',
        persons = v_persons,
        result = v_result,
        total_amount = p_total_amount
    where id = v_existing.id;
    v_split_id := v_existing.id;
  end if;

  foreach v_key in array p_party_keys loop
    select r.row ->> 'name' into v_name
    from jsonb_array_elements(
      case when p_action = 'unlock' then v_old_result else v_result end
    ) as r(row)
    where public.individual_ticket_key(r.row) = v_key
    limit 1;

    -- Prefer call-time stamp (names + line amounts); else legacy key+qty only.
    v_items := coalesce(
      case
        when jsonb_typeof(coalesce(p_ticket_signal_items, '{}'::jsonb) -> v_key) = 'array'
             and jsonb_array_length(coalesce(p_ticket_signal_items, '{}'::jsonb) -> v_key) > 0
        then coalesce(p_ticket_signal_items, '{}'::jsonb) -> v_key
        else null
      end,
      (
        select coalesce(jsonb_agg(jsonb_build_object(
            'key', s ->> 'key',
            'qty_num', (s ->> 'qty_num')::integer,
            'qty_den', (s ->> 'qty_den')::integer
          )), '[]'::jsonb)
        from jsonb_array_elements(v_persons) as p(row)
        cross join lateral jsonb_array_elements(coalesce(p.row -> 'item_shares', '[]'::jsonb)) as s
        where public.individual_ticket_key(p.row) = v_key
      )
    );

    if p_action = 'call' then
      insert into public.bill_split_ticket_calls (
        restaurant_id, session_id, bill_split_id, ticket_key, name, client_id, state
      ) values (
        p_restaurant_id, p_session_id, v_split_id, v_key, coalesce(v_name, ''), p_client_id, 'called'
      )
      on conflict (bill_split_id, ticket_key)
      do update set state = 'called',
                    client_id = excluded.client_id,
                    name = excluded.name,
                    called_at = now(),
                    updated_at = now();
      insert into public.table_checkout_signals (
        restaurant_id, session_id, kind, reason, ticket_key, name, items
      ) values (
        p_restaurant_id, p_session_id, 'call', 'call', v_key, coalesce(v_name, ''), v_items
      );
    else
      delete from public.bill_split_ticket_calls
      where bill_split_id = v_split_id and ticket_key = v_key;
      insert into public.table_checkout_signals (
        restaurant_id, session_id, kind, reason, ticket_key, name, items
      ) values (
        p_restaurant_id, p_session_id, 'silent', 'unlock', v_key, coalesce(v_name, ''), '[]'::jsonb
      );
    end if;
  end loop;

  if p_action = 'unlock'
    and not public.individual_split_has_called_unpaid(v_split_id)
    and not exists (
      select 1
      from public.session_collected_payments scp
      where scp.restaurant_id = p_restaurant_id
        and scp.session_id = p_session_id
    )
  then
    -- Nobody is waiting to pay and nothing was ever collected: release the table from the queue.
    -- Once money was collected the takeover stays so staff keep the table to keep collecting.
    update public.bill_splits
    set staff_checkout_requested_at = null
    where id = v_split_id;
  end if;

  perform public.individual_refresh_split_status(v_split_id);
  perform set_config('mesa.individual_action', '', true);

  select revision, status into v_revision, v_status
  from public.bill_splits where id = v_split_id;

  return jsonb_build_object(
    'ok', true,
    'bill_split_id', v_split_id,
    'revision', v_revision,
    'status', v_status,
    'persons', v_persons,
    'result', v_result,
    'total_amount', p_total_amount
  );
exception
  when others then
    return jsonb_build_object('ok', false, 'code', 'individual_apply_failed', 'message', sqlerrm);
end;
$$;

revoke all on function public.individual_checkout_apply(
  uuid, uuid, uuid, text, uuid[], text, text, uuid, text[], integer, jsonb, jsonb, numeric, jsonb
) from public;
grant execute on function public.individual_checkout_apply(
  uuid, uuid, uuid, text, uuid[], text, text, uuid, text[], integer, jsonb, jsonb, numeric, jsonb
) to service_role;
