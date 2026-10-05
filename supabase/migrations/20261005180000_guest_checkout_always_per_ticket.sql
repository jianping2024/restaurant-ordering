-- Guest checkout is always per-ticket: drop the `guest_individual_checkout` switch.
-- Every session is per-ticket and never enters `billing` (the status value itself stays valid).
-- Append-only: replaces the objects created in 20261005120000_guest_individual_checkout.sql.

drop trigger if exists table_sessions_stamp_individual_checkout on public.table_sessions;
drop function if exists public.stamp_table_session_individual_checkout();

drop trigger if exists table_sessions_individual_never_billing on public.table_sessions;
drop function if exists public.keep_individual_session_out_of_billing();

create or replace function public.keep_session_out_of_billing()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'billing' then
    new.status := 'open';
  end if;
  return new;
end;
$$;

drop trigger if exists table_sessions_never_billing on public.table_sessions;
create trigger table_sessions_never_billing
  before update on public.table_sessions
  for each row execute function public.keep_session_out_of_billing();

create or replace function public.bill_splits_individual_sync()
returns trigger
language plpgsql
security definer
set search_path to public
as $$
declare
  v_in_action boolean := coalesce(current_setting('mesa.individual_action', true), '') = '1';
  v_plan_edit boolean;
begin
  if pg_trigger_depth() > 1 or new.session_id is null then
    return null;
  end if;

  if new.status in ('paid', 'cancelled') then
    return null;
  end if;

  -- Staff plan write or staff-initiated checkout request (status flipped into requested).
  v_plan_edit := tg_op = 'INSERT'
    or new.persons is distinct from old.persons
    or new.split_mode is distinct from old.split_mode
    or (new.status = 'requested' and old.status is distinct from 'requested');

  if not v_in_action then
    delete from public.bill_split_ticket_calls c
    where c.bill_split_id = new.id
      and not exists (
        select 1
        from jsonb_array_elements(coalesce(new.result, '[]'::jsonb)) as r(row)
        where public.individual_ticket_key(r.row) = c.ticket_key
      );

    if v_plan_edit then
      -- A staff plan write is a staff-initiated checkout for every unpaid ticket.
      insert into public.bill_split_ticket_calls (
        restaurant_id, session_id, bill_split_id, ticket_key, name, client_id, state
      )
      select new.restaurant_id, new.session_id, new.id,
             public.individual_ticket_key(r.row), coalesce(r.row ->> 'name', ''), null, 'called'
      from jsonb_array_elements(coalesce(new.result, '[]'::jsonb)) as r(row)
      where not coalesce((r.row ->> 'paid')::boolean, false)
        and public.individual_ticket_key(r.row) <> ''
      on conflict (bill_split_id, ticket_key)
      do update set state = 'called', updated_at = now()
      where bill_split_ticket_calls.state = 'unlocked';
    end if;

    if tg_op = 'UPDATE'
      and (new.result is distinct from old.result or new.persons is distinct from old.persons)
    then
      insert into public.table_checkout_signals (restaurant_id, session_id, kind, reason)
      values (new.restaurant_id, new.session_id, 'silent', 'update');
    end if;
  end if;

  perform public.individual_refresh_split_status(new.id);
  return null;
exception
  when others then
    -- Never block payments or plan writes because of bookkeeping.
    raise warning 'bill_splits_individual_sync failed: %', sqlerrm;
    return null;
end;
$$;

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
  p_total_amount numeric
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
    from jsonb_array_elements(v_result) as r(row)
    where public.individual_ticket_key(r.row) = v_key
    limit 1;

    select coalesce(jsonb_agg(jsonb_build_object(
        'key', s ->> 'key',
        'qty_num', (s ->> 'qty_num')::integer,
        'qty_den', (s ->> 'qty_den')::integer
      )), '[]'::jsonb)
    into v_items
    from jsonb_array_elements(v_persons) as p(row)
    cross join lateral jsonb_array_elements(coalesce(p.row -> 'item_shares', '[]'::jsonb)) as s
    where public.individual_ticket_key(p.row) = v_key;

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
      update public.bill_split_ticket_calls
      set state = 'unlocked', updated_at = now()
      where bill_split_id = v_split_id and ticket_key = v_key;
      insert into public.table_checkout_signals (
        restaurant_id, session_id, kind, reason, ticket_key, name, items
      ) values (
        p_restaurant_id, p_session_id, 'silent', 'unlock', v_key, coalesce(v_name, ''), '[]'::jsonb
      );
    end if;
  end loop;

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

alter table public.table_sessions drop column if exists individual_checkout;
