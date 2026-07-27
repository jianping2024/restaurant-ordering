-- Session transfer audit events + merge operator on source close.

CREATE TABLE public.table_session_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants (id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.table_sessions (id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('transfer')),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  operator_user_id uuid REFERENCES auth.users (id) ON DELETE RESTRICT,
  from_table_id uuid NOT NULL REFERENCES public.restaurant_tables (id),
  to_table_id uuid NOT NULL REFERENCES public.restaurant_tables (id),
  from_display_name text NOT NULL,
  to_display_name text NOT NULL
);

CREATE INDEX idx_table_session_events_session_occurred
  ON public.table_session_events (session_id, occurred_at ASC);

CREATE INDEX idx_table_session_events_restaurant_from_table
  ON public.table_session_events (restaurant_id, from_table_id);

ALTER TABLE public.table_session_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY table_session_events_owner_select ON public.table_session_events
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    restaurant_id IN (
      SELECT id FROM public.restaurants WHERE owner_id = (SELECT auth.uid())
    )
  );

CREATE POLICY table_session_events_staff_select ON public.table_session_events
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.is_active_restaurant_staff(restaurant_id, ARRAY['waiter', 'frontdesk', 'cashier']::text[]));

COMMENT ON TABLE public.table_session_events IS
  'Append-only mid-session audit (transfer). Order history reads via service role.';

COMMENT ON COLUMN public.table_sessions.closed_by_user_id IS
  'Auth user who closed the session: checkout/settled/operational close, or merge operator when closed_reason=merged. Null for auto_nightly or legacy.';

CREATE OR REPLACE FUNCTION public.assert_restaurant_session_operator(
  p_restaurant_id uuid,
  p_operator_user_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  IF p_operator_user_id IS NULL THEN
    RAISE EXCEPTION 'session operator required';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = p_restaurant_id AND r.owner_id = p_operator_user_id
  ) THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.restaurant_staff_accounts a
    WHERE a.restaurant_id = p_restaurant_id
      AND a.user_id = p_operator_user_id
      AND a.disabled_at IS NULL
      AND a.role = ANY (ARRAY['waiter', 'frontdesk', 'cashier']::text[])
  ) THEN
    RETURN;
  END IF;

  RAISE EXCEPTION 'invalid session operator';
END;
$$;

REVOKE ALL ON FUNCTION public.assert_restaurant_session_operator(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_restaurant_session_operator(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assert_restaurant_session_operator(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.transfer_table_session(
  p_restaurant_id uuid,
  p_from_table_id uuid,
  p_to_table_id uuid,
  p_operator_user_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_source_session public.table_sessions%rowtype;
  v_target_session_id uuid;
  v_target_display text;
  v_from_display text;
  v_operator_id uuid;
BEGIN
  v_operator_id := coalesce(p_operator_user_id, auth.uid());
  PERFORM public.assert_restaurant_session_operator(p_restaurant_id, v_operator_id);

  IF p_from_table_id = p_to_table_id THEN
    RAISE EXCEPTION 'source and target table cannot be the same';
  END IF;

  SELECT display_name INTO v_target_display
  FROM public.get_active_restaurant_table(p_restaurant_id, p_to_table_id);
  IF v_target_display IS NULL THEN
    RAISE EXCEPTION 'invalid target table';
  END IF;

  SELECT display_name INTO v_from_display
  FROM public.get_active_restaurant_table(p_restaurant_id, p_from_table_id);
  IF v_from_display IS NULL THEN
    RAISE EXCEPTION 'invalid source table';
  END IF;

  SELECT *
  INTO v_source_session
  FROM public.table_sessions
  WHERE restaurant_id = p_restaurant_id
    AND table_id = p_from_table_id
    AND status IN ('open', 'billing')
  ORDER BY opened_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'source table has no active session';
  END IF;

  SELECT id
  INTO v_target_session_id
  FROM public.table_sessions
  WHERE restaurant_id = p_restaurant_id
    AND table_id = p_to_table_id
    AND status IN ('open', 'billing')
  ORDER BY opened_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_target_session_id IS NOT NULL THEN
    RAISE EXCEPTION 'target table already has active session';
  END IF;

  UPDATE public.table_sessions
  SET table_id = p_to_table_id
  WHERE id = v_source_session.id;

  UPDATE public.orders
  SET table_id = p_to_table_id,
      display_name = v_target_display,
      session_id = coalesce(session_id, v_source_session.id)
  WHERE restaurant_id = p_restaurant_id
    AND table_id = p_from_table_id
    AND status IN ('pending', 'cooking', 'done')
    AND (session_id IS NULL OR session_id = v_source_session.id);

  UPDATE public.bill_splits
  SET table_id = p_to_table_id,
      display_name = v_target_display,
      session_id = coalesce(session_id, v_source_session.id)
  WHERE restaurant_id = p_restaurant_id
    AND table_id = p_from_table_id
    AND status IN ('pending', 'confirmed', 'requested')
    AND (session_id IS NULL OR session_id = v_source_session.id);

  INSERT INTO public.table_session_events (
    restaurant_id,
    session_id,
    event_type,
    occurred_at,
    operator_user_id,
    from_table_id,
    to_table_id,
    from_display_name,
    to_display_name
  ) VALUES (
    p_restaurant_id,
    v_source_session.id,
    'transfer',
    now(),
    v_operator_id,
    p_from_table_id,
    p_to_table_id,
    v_from_display,
    v_target_display
  );

  RETURN v_source_session.id;
END;
$$;

-- merge_table_sessions: record merge operator on source close (same body as 20260716120000 + operator).
CREATE OR REPLACE FUNCTION public.merge_table_sessions(
  p_restaurant_id uuid,
  p_source_table_id uuid,
  p_target_table_id uuid,
  p_operator_user_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $_$
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

  update public.table_sessions
  set status = 'closed',
      closed_at = now(),
      closed_reason = 'merged',
      merge_into_session_id = v_target_session.id,
      closed_by_user_id = v_operator_id
  where id = v_source_session.id;

  return v_target_session.id;
end;
$_$;

CREATE OR REPLACE FUNCTION public.merge_multiple_table_sessions(
  p_restaurant_id uuid,
  p_source_table_ids uuid[],
  p_target_table_id uuid,
  p_operator_user_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_source_id uuid;
  v_target_session_id uuid;
BEGIN
  IF p_source_table_ids IS NULL OR array_length(p_source_table_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'source tables cannot be empty';
  END IF;

  IF p_target_table_id = ANY (p_source_table_ids) THEN
    RAISE EXCEPTION 'target cannot be among sources';
  END IF;

  FOREACH v_source_id IN ARRAY p_source_table_ids LOOP
    v_target_session_id := public.merge_table_sessions(
      p_restaurant_id,
      v_source_id,
      p_target_table_id,
      p_operator_user_id
    );
  END LOOP;

  RETURN v_target_session_id;
END;
$$;
