-- 换套餐（重算菜价）+ 并发核对 + 并台规则扩展。
-- 1) order_item_is_buffet_priced：唯一「按套餐取价的菜品行」判断（TS 孪生 isBuffetPricedDishLine）：
--    有效（未作废）、普通菜品（非人头 / 外卖开价 / 打包费）、非后厨重做。
-- 2) append_order_items 多一个参数 p_priced_buffet_id：新行里有按套餐取价的菜品行时，锁内核对
--    这桌当前套餐（table_session_current_buffet_id），不一致 → code buffet_changed（409）。
-- 3) switch_table_buffet：同一把锁里核对「换之前的套餐」+「提交的价格覆盖了全部菜品行」，
--    作废旧人头行、写新价、追加新人头行。不一致 → buffet_changed / lines_changed（应用层重算再提交）。
-- 4) merge_table_sessions：两桌当前套餐不同（含一桌有一桌没有）→ buffet_mismatch。

CREATE OR REPLACE FUNCTION public.order_item_is_buffet_priced(p_item jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT coalesce(p_item->>'kind', 'menu') NOT IN ('buffet_base', 'takeaway', 'packaging')
    AND coalesce((p_item->>'kitchen_remake')::boolean, false) = false
    AND coalesce(p_item->>'item_status', 'pending') <> 'voided';
$$;

DROP FUNCTION IF EXISTS public.append_order_items(uuid, uuid, uuid, text, jsonb);

CREATE OR REPLACE FUNCTION public.append_order_items(p_restaurant_id uuid, p_session_id uuid, p_table_id uuid, p_display_name text, p_new_items jsonb, p_priced_buffet_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $fn$
declare
  v_order public.orders%rowtype;
  v_prior jsonb;
  v_merged jsonb;
  v_elem jsonb;
  v_had_done_before boolean := false;
  v_is_first_order boolean := false;
  v_total numeric := 0;
  v_status text := 'pending';
  v_kitchen_count int := 0;
  v_kitchen_voided int := 0;
  v_kitchen_done_or_voided int := 0;
  v_has_non_kitchen boolean := false;
  v_item_status text;
  v_kind text;
  v_price numeric;
  v_qty numeric;
  v_new_id uuid;
  v_session public.table_sessions%rowtype;
begin
  if p_restaurant_id is null or p_session_id is null or p_table_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_args');
  end if;

  if p_new_items is null or jsonb_typeof(p_new_items) <> 'array' or jsonb_array_length(p_new_items) < 1 then
    return jsonb_build_object('ok', false, 'code', 'invalid_items');
  end if;

  -- Serialize all appends for this session (merge target + first-insert race).
  perform pg_advisory_xact_lock(hashtext(p_session_id::text));

  -- Dish lines must be priced for the table's current buffet (same lock as switch_table_buffet).
  if exists (
    select 1 from jsonb_array_elements(p_new_items) e
    where public.order_item_is_buffet_priced(e)
  ) then
    select * into v_session
    from public.table_sessions
    where id = p_session_id and restaurant_id = p_restaurant_id;
    if public.table_session_current_buffet_id(v_session) is distinct from p_priced_buffet_id then
      return jsonb_build_object('ok', false, 'code', 'buffet_changed');
    end if;
  end if;

  select *
    into v_order
  from public.orders
  where restaurant_id = p_restaurant_id
    and session_id = p_session_id
    and status in ('pending', 'cooking', 'done')
  order by created_at desc nulls last
  limit 1
  for update;

  if found then
    v_prior := coalesce(v_order.items, '[]'::jsonb);
    if jsonb_typeof(v_prior) <> 'array' then
      v_prior := '[]'::jsonb;
    end if;

    v_had_done_before := (
      jsonb_array_length(v_prior) > 0
      and not exists (
        select 1
        from jsonb_array_elements(v_prior) e
        where coalesce(e->>'item_status', 'pending') is distinct from 'done'
      )
    );

    v_merged := v_prior || p_new_items;
    v_is_first_order := false;
  else
    v_prior := '[]'::jsonb;
    v_merged := p_new_items;
    v_had_done_before := false;
    v_is_first_order := true;
  end if;

  -- total_amount: sum price*qty for non-voided (qty falls back to quantity).
  for v_elem in select value from jsonb_array_elements(v_merged)
  loop
    v_item_status := coalesce(v_elem->>'item_status', 'pending');
    if v_item_status = 'voided' then
      continue;
    end if;
    begin
      v_price := coalesce((v_elem->>'price')::numeric, 0);
    exception when others then
      v_price := 0;
    end;
    begin
      if v_elem ? 'qty' and nullif(v_elem->>'qty', '') is not null then
        v_qty := (v_elem->>'qty')::numeric;
      elsif v_elem ? 'quantity' and nullif(v_elem->>'quantity', '') is not null then
        v_qty := (v_elem->>'quantity')::numeric;
      else
        v_qty := 0;
      end if;
    exception when others then
      v_qty := 0;
    end;
    v_total := v_total + (v_price * v_qty);
  end loop;

  -- status: mirror deriveOrderStatusFromItems (kitchen = menu lines only;
  -- buffet_base headcount + takeaway checkout charge are non-kitchen).
  for v_elem in select value from jsonb_array_elements(v_merged)
  loop
    v_kind := coalesce(v_elem->>'kind', '');
    if v_kind in ('buffet_base', 'takeaway') then
      v_has_non_kitchen := true;
      continue;
    end if;
    v_kitchen_count := v_kitchen_count + 1;
    v_item_status := coalesce(v_elem->>'item_status', 'pending');
    if v_item_status = 'voided' then
      v_kitchen_voided := v_kitchen_voided + 1;
      v_kitchen_done_or_voided := v_kitchen_done_or_voided + 1;
    elsif v_item_status = 'done' then
      v_kitchen_done_or_voided := v_kitchen_done_or_voided + 1;
    end if;
  end loop;

  if v_kitchen_count = 0 then
    if jsonb_array_length(v_merged) = 0 then
      v_status := 'pending';
    elsif v_has_non_kitchen then
      v_status := 'done';
    else
      v_status := 'pending';
    end if;
  elsif v_kitchen_voided = v_kitchen_count then
    v_status := 'pending';
  elsif v_kitchen_done_or_voided = v_kitchen_count then
    v_status := 'done';
  elsif exists (
    select 1
    from jsonb_array_elements(v_merged) e
    where coalesce(e->>'kind', '') not in ('buffet_base', 'takeaway')
      and coalesce(e->>'item_status', 'pending') in ('cooking', 'ready', 'done')
  ) then
    v_status := 'cooking';
  else
    v_status := 'pending';
  end if;

  if not v_is_first_order then
    update public.orders
    set
      items = v_merged,
      total_amount = v_total,
      status = v_status
    where id = v_order.id
      and restaurant_id = p_restaurant_id;

    return jsonb_build_object(
      'ok', true,
      'order_id', v_order.id,
      'had_done_before', v_had_done_before,
      'is_first_order', false
    );
  end if;

  insert into public.orders (
    restaurant_id,
    session_id,
    table_id,
    display_name,
    status,
    items,
    total_amount
  )
  values (
    p_restaurant_id,
    p_session_id,
    p_table_id,
    coalesce(nullif(trim(p_display_name), ''), p_table_id::text),
    v_status,
    v_merged,
    v_total
  )
  returning id into v_new_id;

  return jsonb_build_object(
    'ok', true,
    'order_id', v_new_id,
    'had_done_before', false,
    'is_first_order', true
  );
end;
$fn$;

REVOKE ALL ON FUNCTION public.append_order_items(uuid, uuid, uuid, text, jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.append_order_items(uuid, uuid, uuid, text, jsonb, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.switch_table_buffet(
  p_restaurant_id uuid,
  p_session_id uuid,
  p_table_id uuid,
  p_display_name text,
  p_from_buffet_id uuid,
  p_buffet_line jsonb,
  p_line_prices jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_session public.table_sessions%rowtype;
  v_order record;
  v_items jsonb;
  v_elem jsonb;
  v_idx int;
  v_entry jsonb;
  v_matched int := 0;
  v_changed boolean;
  v_carrier_id uuid;
  v_new_id uuid;
BEGIN
  IF p_line_prices IS NULL OR jsonb_typeof(p_line_prices) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_args');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_session_id::text));

  SELECT * INTO v_session
  FROM public.table_sessions
  WHERE id = p_session_id
    AND restaurant_id = p_restaurant_id
    AND table_id = p_table_id
    AND status IN ('open', 'billing')
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'session_not_found');
  END IF;

  IF public.table_session_current_buffet_id(v_session) IS DISTINCT FROM p_from_buffet_id THEN
    RETURN jsonb_build_object('ok', false, 'code', 'buffet_changed');
  END IF;

  -- Every active buffet-priced dish line must carry a submitted price (same dish + batch).
  FOR v_order IN
    SELECT o.id, o.items
    FROM public.orders o
    WHERE o.restaurant_id = p_restaurant_id
      AND o.session_id = p_session_id
      AND o.status IN ('pending', 'cooking', 'done')
    ORDER BY o.created_at
    FOR UPDATE
  LOOP
    FOR v_elem, v_idx IN
      SELECT e, (ord - 1)::int
      FROM jsonb_array_elements(coalesce(v_order.items, '[]'::jsonb)) WITH ORDINALITY AS t(e, ord)
    LOOP
      CONTINUE WHEN NOT public.order_item_is_buffet_priced(v_elem);
      SELECT x INTO v_entry
      FROM jsonb_array_elements(p_line_prices) x
      WHERE (x->>'order_id')::uuid = v_order.id
        AND (x->>'index')::int = v_idx
        AND x->>'menu_item_id' = v_elem->>'id'
        AND coalesce(x->>'batch_id', '') = coalesce(v_elem->>'batch_id', '')
      LIMIT 1;
      IF v_entry IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'lines_changed');
      END IF;
      v_matched := v_matched + 1;
    END LOOP;
  END LOOP;
  IF v_matched <> jsonb_array_length(p_line_prices) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'lines_changed');
  END IF;

  SELECT o.id INTO v_carrier_id
  FROM public.orders o
  WHERE o.restaurant_id = p_restaurant_id
    AND o.session_id = p_session_id
    AND o.table_id = p_table_id
    AND o.status IN ('pending', 'cooking', 'done')
  ORDER BY o.created_at DESC NULLS LAST
  LIMIT 1;

  FOR v_order IN
    SELECT o.id, o.items
    FROM public.orders o
    WHERE o.restaurant_id = p_restaurant_id
      AND o.session_id = p_session_id
      AND o.status IN ('pending', 'cooking', 'done')
  LOOP
    v_items := public.void_active_buffet_lines_in_items(coalesce(v_order.items, '[]'::jsonb));
    v_changed := v_items IS DISTINCT FROM v_order.items;
    FOR v_entry IN
      SELECT x FROM jsonb_array_elements(p_line_prices) x
      WHERE (x->>'order_id')::uuid = v_order.id
    LOOP
      v_idx := (v_entry->>'index')::int;
      v_elem := v_items->v_idx;
      v_elem := jsonb_set(v_elem, '{price}', v_entry->'price');
      IF nullif(v_entry->>'per_person_qty_limit', '') IS NULL THEN
        v_elem := v_elem - 'per_person_qty_limit' - 'over_limit_unit_price';
      ELSE
        v_elem := v_elem
          || jsonb_build_object(
            'per_person_qty_limit', v_entry->'per_person_qty_limit',
            'over_limit_unit_price', v_entry->'over_limit_unit_price'
          );
      END IF;
      v_items := jsonb_set(v_items, ARRAY[v_idx::text], v_elem);
      v_changed := true;
    END LOOP;
    IF v_order.id = v_carrier_id AND p_buffet_line IS NOT NULL THEN
      v_items := v_items || jsonb_build_array(p_buffet_line);
      v_changed := true;
    END IF;
    IF v_changed THEN
      UPDATE public.orders
      SET items = v_items,
          total_amount = public.recalc_order_total_from_items(v_items)
      WHERE id = v_order.id;
    END IF;
  END LOOP;

  IF v_carrier_id IS NULL AND p_buffet_line IS NOT NULL THEN
    INSERT INTO public.orders (restaurant_id, session_id, table_id, display_name, status, items, total_amount)
    VALUES (
      p_restaurant_id,
      p_session_id,
      p_table_id,
      coalesce(nullif(trim(p_display_name), ''), p_table_id::text),
      'done',
      jsonb_build_array(p_buffet_line),
      public.recalc_order_total_from_items(jsonb_build_array(p_buffet_line))
    )
    RETURNING id INTO v_new_id;
    v_carrier_id := v_new_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'carrier_order_id', v_carrier_id, 'inserted', v_new_id IS NOT NULL);
END;
$fn$;

REVOKE ALL ON FUNCTION public.switch_table_buffet(uuid, uuid, uuid, text, uuid, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.switch_table_buffet(uuid, uuid, uuid, text, uuid, jsonb, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.merge_table_sessions(p_restaurant_id uuid, p_source_table_id uuid, p_target_table_id uuid, p_operator_user_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $fn$
declare
  v_source_session public.table_sessions%rowtype;
  v_target_session public.table_sessions%rowtype;
  v_source_split public.bill_splits%rowtype;
  v_target_split public.bill_splits%rowtype;
  v_target_display text;
  v_buffet_id uuid;
  v_buffet_name text;
  v_distinct_buffets int;
  v_adults int := 0;
  v_children int := 0;
  v_adult_price numeric;
  v_child_price numeric;
  v_rule_id uuid;
  v_line_total numeric;
  v_carrier_order_id uuid;
  v_carrier_items jsonb;
  v_merged_line jsonb;
  v_now text;
  v_new_items jsonb;
  v_new_total numeric;
  v_order_rec record;
  v_operator_id uuid;
begin
  v_operator_id := coalesce(p_operator_user_id, auth.uid());
  perform public.assert_restaurant_session_operator(p_restaurant_id, v_operator_id);

  if p_source_table_id = p_target_table_id then
    raise exception 'source and target table cannot be the same';
  end if;

  select display_name into v_target_display
  from public.get_active_restaurant_table(p_restaurant_id, p_target_table_id);
  if v_target_display is null then
    raise exception 'invalid target table';
  end if;

  select *
  into v_source_session
  from public.table_sessions
  where restaurant_id = p_restaurant_id
    and table_id = p_source_table_id
    and status in ('open', 'billing')
  order by opened_at desc
  limit 1
  for update;

  if not found then
    raise exception 'source table has no active session';
  end if;

  select *
  into v_target_session
  from public.table_sessions
  where restaurant_id = p_restaurant_id
    and table_id = p_target_table_id
    and status in ('open', 'billing')
  order by opened_at desc
  limit 1
  for update;

  if not found then
    raise exception 'target table has no active session';
  end if;

  -- One table, one buffet: different packages (incl. one side without a buffet) never merge.
  if public.table_session_current_buffet_id(v_source_session)
     is distinct from public.table_session_current_buffet_id(v_target_session) then
    raise exception 'buffet_mismatch';
  end if;

  update public.bill_splits
  set session_id = v_source_session.id
  where restaurant_id = p_restaurant_id
    and table_id = p_source_table_id
    and status in ('pending', 'confirmed', 'requested')
    and session_id is null;

  update public.bill_splits
  set session_id = v_target_session.id
  where restaurant_id = p_restaurant_id
    and table_id = p_target_table_id
    and status in ('pending', 'confirmed', 'requested')
    and session_id is null;

  update public.orders
  set session_id = v_target_session.id
  where restaurant_id = p_restaurant_id
    and status in ('pending', 'cooking', 'done')
    and (
      session_id = v_source_session.id
      or (
        table_id = p_source_table_id
        and (session_id is null or session_id = v_source_session.id)
      )
    );

  select
    count(distinct bl.buffet_id),
    (min(bl.buffet_id::text))::uuid,
    coalesce(sum(bl.adults), 0)::int,
    coalesce(sum(bl.children), 0)::int
  into v_distinct_buffets, v_buffet_id, v_adults, v_children
  from (
    select
      (el->>'buffet_id')::uuid as buffet_id,
      coalesce((el->>'adult_count')::int, 0) as adults,
      coalesce((el->>'child_count')::int, 0) as children
    from public.orders o
    cross join lateral jsonb_array_elements(coalesce(o.items, '[]'::jsonb)) el
    where o.restaurant_id = p_restaurant_id
      and o.session_id = v_target_session.id
      and o.status in ('pending', 'cooking', 'done')
      and el->>'kind' = 'buffet_base'
      and coalesce(el->>'item_status', 'pending') <> 'voided'
      and el ? 'buffet_id'
      and (el->>'buffet_id') ~* '^[0-9a-f-]{36}$'
  ) bl;

  if coalesce(v_distinct_buffets, 0) > 1 then
    raise exception 'multiple buffet types cannot be merged';
  end if;

  if v_buffet_id is not null and (v_adults + v_children) > 0 then
    for v_order_rec in
      select o.id, o.items
      from public.orders o
      where o.restaurant_id = p_restaurant_id
        and o.session_id = v_target_session.id
        and o.status in ('pending', 'cooking', 'done')
    loop
      v_new_items := public.void_active_buffet_lines_in_items(v_order_rec.items);
      v_new_total := public.recalc_order_total_from_items(v_new_items);
      update public.orders
      set items = v_new_items,
          total_amount = v_new_total
      where id = v_order_rec.id;
    end loop;

    select r.adult_price, r.child_price, r.rule_id
    into v_adult_price, v_child_price, v_rule_id
    from public.resolve_buffet_prices(p_restaurant_id, v_buffet_id, now()) r
    limit 1;

    if v_adult_price is null or v_child_price is null then
      raise exception 'no buffet price rule at merge time';
    end if;

    select b.name into v_buffet_name
    from public.buffets b
    where b.id = v_buffet_id
      and b.restaurant_id = p_restaurant_id;

    v_line_total := v_adults * v_adult_price + v_children * v_child_price;
    v_now := to_char(timezone('utc', now()), 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"');

    v_merged_line := jsonb_build_object(
      'id', 'buffet:' || v_buffet_id::text,
      'kind', 'buffet_base',
      'name', coalesce(v_buffet_name, 'Buffet'),
      'name_pt', coalesce(v_buffet_name, 'Buffet'),
      'qty', 1,
      'price', v_line_total,
      'emoji', '🍽️',
      'item_status', 'done',
      'buffet_id', v_buffet_id::text,
      'adult_count', v_adults,
      'child_count', v_children,
      'adult_unit_price', v_adult_price,
      'child_unit_price', v_child_price,
      'price_rule_id', v_rule_id::text,
      'added_at', v_now,
      'batch_id', '__buffet__'
    );

    select o.id, o.items
    into v_carrier_order_id, v_carrier_items
    from public.orders o
    where o.restaurant_id = p_restaurant_id
      and o.session_id = v_target_session.id
      and o.status in ('pending', 'cooking', 'done')
    order by (o.table_id = p_target_table_id) desc, o.created_at desc
    limit 1;

    if v_carrier_order_id is null then
      insert into public.orders (
        restaurant_id,
        session_id,
        table_id,
        display_name,
        status,
        items,
        total_amount
      )
      values (
        p_restaurant_id,
        v_target_session.id,
        p_target_table_id,
        v_target_display,
        'done',
        jsonb_build_array(v_merged_line),
        v_line_total
      );
    else
      v_new_items := coalesce(v_carrier_items, '[]'::jsonb) || v_merged_line;
      v_new_total := public.recalc_order_total_from_items(v_new_items);
      update public.orders
      set items = v_new_items,
          total_amount = v_new_total,
          status = case
            when exists (
              select 1
              from jsonb_array_elements(v_new_items) el
              where coalesce(el->>'item_status', 'pending') not in ('voided', 'done')
                and coalesce(el->>'kind', 'menu') <> 'buffet_base'
            ) then status
            else 'done'
          end
      where id = v_carrier_order_id;
    end if;
  end if;

  select *
  into v_source_split
  from public.bill_splits
  where session_id = v_source_session.id
    and status in ('pending', 'confirmed', 'requested')
  order by created_at desc
  limit 1
  for update;

  select *
  into v_target_split
  from public.bill_splits
  where session_id = v_target_session.id
    and status in ('pending', 'confirmed', 'requested')
  order by created_at desc
  limit 1
  for update;

  if v_source_split.id is not null and v_target_split.id is not null then
    update public.bill_splits
    set order_ids = (
          select array_agg(distinct x)
          from unnest(coalesce(v_target_split.order_ids, '{}'::uuid[]) || coalesce(v_source_split.order_ids, '{}'::uuid[])) as x
        ),
        persons = coalesce(v_target_split.persons, '[]'::jsonb) || coalesce(v_source_split.persons, '[]'::jsonb),
        result = coalesce(v_target_split.result, '[]'::jsonb) || coalesce(v_source_split.result, '[]'::jsonb),
        total_amount = coalesce(v_target_split.total_amount, 0) + coalesce(v_source_split.total_amount, 0)
    where id = v_target_split.id;

    delete from public.bill_splits
    where id = v_source_split.id;
  elsif v_source_split.id is not null then
    update public.bill_splits
    set session_id = v_target_session.id,
        table_id = p_target_table_id,
        display_name = v_target_display
    where id = v_source_split.id;
  end if;

  update public.bill_splits
  set session_id = v_target_session.id,
      table_id = p_target_table_id,
      display_name = v_target_display
  where session_id = v_source_session.id
    and status in ('pending', 'confirmed', 'requested');

  -- Source sushi rounds: discard basket in same TX (do not merge into target).
  update public.table_order_rounds
  set status = 'closed',
      updated_at = now()
  where session_id = v_source_session.id
    and status in ('collecting', 'pending_confirm', 'cooldown', 'finalize_failed');

  update public.table_sessions
  set status = 'closed',
      closed_at = now(),
      closed_reason = 'merged',
      merge_into_session_id = v_target_session.id,
      closed_by_user_id = v_operator_id
  where id = v_source_session.id;

  return v_target_session.id;
end;
$fn$;
