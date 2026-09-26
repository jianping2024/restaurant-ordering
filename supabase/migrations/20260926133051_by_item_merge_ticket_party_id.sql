-- By-item ledger merge: match tickets by party_id when present, else name.
-- Same display name + different party_id must not collide.
-- Resume: by_item with one paid result row is not whole_table_paid.

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
  v_ex_party text;
  v_inc_party text;
  v_ex_name text;
  v_inc_name text;
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

  if v_inc_len = 0 then
    return v_ex;
  end if;
  if v_ex_len = 0 then
    return v_inc;
  end if;

  v_used := array_fill(false, array[v_inc_len]);

  for v_i in 0 .. v_ex_len - 1 loop
    v_ex_row := v_ex -> v_i;
    v_ex_party := nullif(btrim(coalesce(v_ex_row ->> 'party_id', '')), '');
    v_ex_name := lower(btrim(coalesce(v_ex_row ->> 'name', '')));
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
    elsif v_ex_name <> '' then
      for v_j in 0 .. v_inc_len - 1 loop
        if v_used[v_j + 1] then
          continue;
        end if;
        v_inc_name := lower(btrim(coalesce(v_inc -> v_j ->> 'name', '')));
        if v_inc_name = v_ex_name then
          v_inc_row := v_inc -> v_j;
          v_used[v_j + 1] := true;
          exit;
        end if;
      end loop;
    end if;

    if v_inc_row is null then
      continue;
    end if;

    v_row := v_ex_row || jsonb_build_object(
      'amount', (v_inc_row ->> 'amount')::numeric,
      'paid',
        coalesce((v_ex_row ->> 'paid')::boolean, false)
        or coalesce((v_inc_row ->> 'paid')::boolean, false)
    );
    v_inc_party := nullif(btrim(coalesce(v_inc_row ->> 'party_id', '')), '');
    if v_inc_party is not null then
      v_row := v_row || jsonb_build_object('party_id', v_inc_party);
    end if;
    v_result := v_result || jsonb_build_array(v_row);
  end loop;

  for v_j in 0 .. v_inc_len - 1 loop
    if v_used[v_j + 1] then
      continue;
    end if;
    v_inc_row := v_inc -> v_j;
    v_inc_name := btrim(coalesce(v_inc_row ->> 'name', ''));
    if v_inc_name = '' then
      continue;
    end if;
    v_result := v_result || jsonb_build_array(v_inc_row);
  end loop;

  return v_result;
end;
$$;

create or replace function public.resume_table_session_ordering(
  p_restaurant_id uuid,
  p_table_id uuid
) returns jsonb
language plpgsql
security definer
set search_path to public
as $$
declare
  v_session public.table_sessions%rowtype;
  v_split public.bill_splits%rowtype;
  v_row jsonb;
  v_len integer;
  v_i integer;
  v_has_paid_row boolean := false;
  v_has_partial_payment boolean := false;
  v_preserve_split boolean := false;
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

  select *
  into v_session
  from public.table_sessions
  where id = v_session.id
    and restaurant_id = p_restaurant_id
  for update;

  if v_session.status not in ('open', 'billing') then
    return jsonb_build_object('ok', false, 'code', 'no_session');
  end if;

  select *
  into v_split
  from public.bill_splits
  where restaurant_id = p_restaurant_id
    and session_id = v_session.id
    and status in ('pending', 'confirmed', 'requested')
  order by created_at desc
  limit 1
  for update;

  if found then
    v_len := jsonb_array_length(coalesce(v_split.result, '[]'::jsonb));
    if v_len > 0 then
      for v_i in 0 .. v_len - 1 loop
        v_row := v_split.result -> v_i;
        if coalesce((v_row->>'paid')::boolean, false) then
          v_has_paid_row := true;
          exit;
        end if;
      end loop;
    end if;

    v_has_partial_payment := v_has_paid_row or exists (
      select 1
      from public.session_collected_payments scp
      where scp.restaurant_id = p_restaurant_id
        and scp.session_id = v_session.id
    );

    -- whole_table_paid: only when the active plan is a single whole-table
    -- obligation (or non-by_item with ≤1 result row) and money was taken.
    -- by_item may legitimately have one paid ticket with outstanding pool.
    if coalesce(v_split.split_mode, '') = 'by_item' then
      null; -- never treat by_item as whole_table_paid via row-count
    elsif v_len <= 1 and v_has_partial_payment then
      return jsonb_build_object('ok', false, 'code', 'whole_table_paid');
    end if;

    v_preserve_split := v_split.split_mode = 'by_item' or v_has_partial_payment;

    if v_preserve_split then
      update public.bill_splits
      set
        status = 'confirmed',
        result = public.reconcile_split_result_paid_from_ledger(
          result,
          p_restaurant_id,
          v_session.id,
          coalesce(discount_rate, 0)
        )
      where restaurant_id = p_restaurant_id
        and session_id = v_session.id
        and status in ('pending', 'confirmed', 'requested');
    else
      update public.bill_splits
      set status = 'cancelled'
      where restaurant_id = p_restaurant_id
        and session_id = v_session.id
        and status in ('pending', 'confirmed', 'requested');
    end if;
  end if;

  update public.table_sessions
  set status = 'open'
  where id = v_session.id
    and status = 'billing';

  return jsonb_build_object(
    'ok', true,
    'session_id', v_session.id,
    'table_id', p_table_id
  );
exception
  when others then
    return jsonb_build_object(
      'ok', false,
      'code', 'resume_failed',
      'message', sqlerrm
    );
end;
$$;

revoke all on function public.merge_by_item_split_result_with_ledger(jsonb, jsonb) from public;
grant execute on function public.merge_by_item_split_result_with_ledger(jsonb, jsonb)
  to authenticated, service_role;

revoke all on function public.resume_table_session_ordering(uuid, uuid) from public;
grant execute on function public.resume_table_session_ordering(uuid, uuid)
  to authenticated, service_role;
