--
-- PostgreSQL database dump
--

\restrict VBpwvkmyHt0sFsZLKaHBvih8Juw4M8enB0EmNwYdC7rKi5QqMw0imJ78bxurLvC

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: abnormal_operations_owner_list(uuid, timestamp with time zone, timestamp with time zone, text, text, uuid, uuid, text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.abnormal_operations_owner_list(p_restaurant_id uuid, p_start_utc timestamp with time zone, p_end_exclusive_utc timestamp with time zone, p_type text DEFAULT NULL::text, p_risk_level text DEFAULT NULL::text, p_operator_id uuid DEFAULT NULL::uuid, p_table_id uuid DEFAULT NULL::uuid, p_status text DEFAULT NULL::text, p_page integer DEFAULT 1, p_page_size integer DEFAULT 20) RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  WITH filtered AS (
    SELECT ao.*
    FROM public.abnormal_operations ao
    WHERE ao.restaurant_id = p_restaurant_id
      AND ao.created_at >= p_start_utc
      AND ao.created_at < p_end_exclusive_utc
      AND (p_type IS NULL OR ao.type = p_type)
      AND (p_risk_level IS NULL OR ao.risk_level = p_risk_level)
      AND (p_operator_id IS NULL OR ao.operator_id = p_operator_id)
      AND (p_table_id IS NULL OR ao.table_id = p_table_id)
      AND (p_status IS NULL OR ao.status = p_status)
  ),
  stats AS (
    SELECT
      count(*)::integer AS total_count,
      count(*) FILTER (WHERE risk_level = 'HIGH')::integer AS high_risk_count,
      count(*) FILTER (WHERE status = 'PENDING')::integer AS pending_count,
      coalesce(sum(amount_impact), 0) AS amount_impact_sum
    FROM filtered
  ),
  page AS (
    SELECT coalesce(
      jsonb_agg(
        to_jsonb(p)
        ORDER BY
          CASE p.risk_level
            WHEN 'HIGH' THEN 0
            WHEN 'MEDIUM' THEN 1
            WHEN 'LOW' THEN 2
            ELSE 3
          END,
          p.created_at DESC
      ),
      '[]'::jsonb
    ) AS items
    FROM (
      SELECT f.*
      FROM filtered f
      ORDER BY
        CASE f.risk_level
          WHEN 'HIGH' THEN 0
          WHEN 'MEDIUM' THEN 1
          WHEN 'LOW' THEN 2
          ELSE 3
        END,
        f.created_at DESC
      OFFSET greatest(coalesce(p_page, 1) - 1, 0) * greatest(least(coalesce(p_page_size, 20), 50), 1)
      LIMIT greatest(least(coalesce(p_page_size, 20), 50), 1)
    ) p
  )
  SELECT jsonb_build_object(
    'items', page.items,
    'stats', jsonb_build_object(
      'total_count', stats.total_count,
      'high_risk_count', stats.high_risk_count,
      'amount_impact_sum', stats.amount_impact_sum,
      'pending_count', stats.pending_count
    ),
    'page', greatest(coalesce(p_page, 1), 1),
    'pageSize', greatest(least(coalesce(p_page_size, 20), 50), 1),
    'total', stats.total_count
  )
  FROM stats, page;
$$;


--
-- Name: append_order_items(uuid, uuid, uuid, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.append_order_items(p_restaurant_id uuid, p_session_id uuid, p_table_id uuid, p_display_name text, p_new_items jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
  v_has_buffet boolean := false;
  v_item_status text;
  v_kind text;
  v_price numeric;
  v_qty numeric;
  v_new_id uuid;
begin
  if p_restaurant_id is null or p_session_id is null or p_table_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_args');
  end if;

  if p_new_items is null or jsonb_typeof(p_new_items) <> 'array' or jsonb_array_length(p_new_items) < 1 then
    return jsonb_build_object('ok', false, 'code', 'invalid_items');
  end if;

  -- Serialize all appends for this session (merge target + first-insert race).
  perform pg_advisory_xact_lock(hashtext(p_session_id::text));

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

  -- status: mirror deriveOrderStatusFromItems (kitchen = not buffet_base).
  for v_elem in select value from jsonb_array_elements(v_merged)
  loop
    v_kind := coalesce(v_elem->>'kind', '');
    if v_kind = 'buffet_base' then
      v_has_buffet := true;
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
    elsif v_has_buffet then
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
    where coalesce(e->>'kind', '') is distinct from 'buffet_base'
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
$$;


--
-- Name: FUNCTION append_order_items(p_restaurant_id uuid, p_session_id uuid, p_table_id uuid, p_display_name text, p_new_items jsonb); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.append_order_items(p_restaurant_id uuid, p_session_id uuid, p_table_id uuid, p_display_name text, p_new_items jsonb) IS 'Sole guest/waiter append write: session advisory lock + latest order FOR UPDATE; append items or insert. Prevents concurrent jsonb lost updates.';


--
-- Name: assert_restaurant_session_operator(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assert_restaurant_session_operator(p_restaurant_id uuid, p_operator_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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
      AND a.role = ANY (ARRAY['waiter', 'frontdesk', 'cashier', 'owner', 'custom']::text[])
  ) THEN
    RETURN;
  END IF;

  RAISE EXCEPTION 'invalid session operator';
END;
$$;


--
-- Name: FUNCTION assert_restaurant_session_operator(p_restaurant_id uuid, p_operator_user_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.assert_restaurant_session_operator(p_restaurant_id uuid, p_operator_user_id uuid) IS 'Transfer/merge operator gate: restaurant owner_id or active staff role in waiter|frontdesk|cashier|owner|custom. Fine-grained tables.transfer/merge is enforced in the app.';


--
-- Name: auth_owned_restaurant_ids(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auth_owned_restaurant_ids() RETURNS SETOF uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select id from public.restaurants where owner_id = auth.uid();
$$;


--
-- Name: auth_staff_restaurant_ids(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auth_staff_restaurant_ids() RETURNS SETOF uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select restaurant_id
  from public.restaurant_staff_accounts
  where user_id = auth.uid()
    and disabled_at is null;
$$;


--
-- Name: bill_splits_bump_revision(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.bill_splits_bump_revision() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.revision := coalesce(old.revision, 0) + 1;
  return new;
end;
$$;


--
-- Name: bill_splits_individual_sync(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.bill_splits_individual_sync() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_in_action boolean := coalesce(current_setting('mesa.individual_action', true), '') = '1';
  v_plan_edit boolean;
  v_plan_changed boolean;
begin
  if pg_trigger_depth() > 1 or new.session_id is null then
    return null;
  end if;

  -- Sole silent update doorbell for plan/payment changes (call/unlock set
  -- mesa.individual_action and insert their own call/unlock rows).
  v_plan_changed := tg_op = 'UPDATE'
    and (
      new.result is distinct from old.result
      or new.persons is distinct from old.persons
      or new.status is distinct from old.status
    );
  if not v_in_action and v_plan_changed then
    insert into public.table_checkout_signals (restaurant_id, session_id, kind, reason)
    values (new.restaurant_id, new.session_id, 'silent', 'update');
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
    if coalesce(new.split_mode, '') <> 'by_item' then
      -- Whole-table / even: session resume-ordering owns restore — never stamp ticket calls.
      delete from public.bill_split_ticket_calls c
      where c.bill_split_id = new.id;
    else
      delete from public.bill_split_ticket_calls c
      where c.bill_split_id = new.id
        and not exists (
          select 1
          from jsonb_array_elements(coalesce(new.result, '[]'::jsonb)) as r(row)
          where public.individual_ticket_key(r.row) = c.ticket_key
        );

      if v_plan_edit then
        -- A staff plan write is a staff-initiated checkout for every unpaid by_item ticket.
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


--
-- Name: checkout_allocate_discounted_obligations(numeric[], numeric, numeric, numeric[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.checkout_allocate_discounted_obligations(p_pre_amounts numeric[], p_discount_rate numeric, p_bill_total numeric DEFAULT NULL::numeric, p_frozen_obligations numeric[] DEFAULT NULL::numeric[]) RETURNS numeric[]
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'public'
    AS $$
DECLARE
  v_n integer;
  v_rate numeric;
  v_bill_pre numeric := 0;
  v_payable_cents bigint;
  v_out bigint[];
  v_weights bigint[];
  v_open_cents bigint[];
  v_weight_sum bigint := 0;
  v_i integer;
  v_rem bigint;
BEGIN
  -- p_frozen_obligations intentionally unused (signature kept for callers).
  PERFORM p_frozen_obligations;

  v_n := coalesce(cardinality(p_pre_amounts), 0);
  IF v_n = 0 THEN
    RETURN ARRAY[]::numeric[];
  END IF;

  v_rate := least(100, greatest(0, coalesce(p_discount_rate, 0)));
  IF v_rate <= 0 THEN
    RETURN (
      SELECT array_agg(round(coalesce(a, 0), 2) ORDER BY ord)
      FROM unnest(p_pre_amounts) WITH ORDINALITY AS t(a, ord)
    );
  END IF;

  IF p_bill_total IS NOT NULL THEN
    v_bill_pre := coalesce(p_bill_total, 0);
  ELSE
    SELECT coalesce(sum(coalesce(a, 0)), 0) INTO v_bill_pre FROM unnest(p_pre_amounts) AS a;
  END IF;

  v_payable_cents := round(public.checkout_round_discount_amount(v_bill_pre, v_rate) * 100)::bigint;
  v_weights := ARRAY[]::bigint[];
  FOR v_i IN 1 .. v_n LOOP
    v_weights := v_weights || greatest(0, round(coalesce(p_pre_amounts[v_i], 0) * 100)::bigint);
  END LOOP;

  SELECT coalesce(sum(w), 0) INTO v_weight_sum FROM unnest(v_weights) AS w;
  v_open_cents := array_fill(0::bigint, ARRAY[v_n]);

  IF v_weight_sum <= 0 OR v_payable_cents <= 0 THEN
    IF v_payable_cents > 0 THEN
      v_open_cents[1] := v_payable_cents;
    END IF;
  ELSE
    FOR v_i IN 1 .. v_n LOOP
      v_open_cents[v_i] := (v_payable_cents * v_weights[v_i]) / v_weight_sum;
    END LOOP;
    v_rem := v_payable_cents - (SELECT coalesce(sum(c), 0) FROM unnest(v_open_cents) AS c);
    FOR v_i IN 1 .. v_n LOOP
      EXIT WHEN v_rem <= 0;
      v_open_cents[v_i] := v_open_cents[v_i] + 1;
      v_rem := v_rem - 1;
    END LOOP;
  END IF;

  RETURN (
    SELECT array_agg((c::numeric / 100) ORDER BY ord)
    FROM unnest(v_open_cents) WITH ORDINALITY AS t(c, ord)
  );
END;
$$;


--
-- Name: FUNCTION checkout_allocate_discounted_obligations(p_pre_amounts numeric[], p_discount_rate numeric, p_bill_total numeric, p_frozen_obligations numeric[]); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.checkout_allocate_discounted_obligations(p_pre_amounts numeric[], p_discount_rate numeric, p_bill_total numeric, p_frozen_obligations numeric[]) IS 'One-cut bill payable into person obligations; frozen arg ignored.';


--
-- Name: checkout_discount_factor(numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.checkout_discount_factor(p_discount_rate numeric) RETURNS numeric
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$
  select 1 - greatest(0, least(100, coalesce(p_discount_rate, 0))) / 100;
$$;


--
-- Name: checkout_payable_from_total(numeric, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.checkout_payable_from_total(p_total_amount numeric, p_discount_rate numeric) RETURNS numeric
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$
  select round(coalesce(p_total_amount, 0) * public.checkout_discount_factor(p_discount_rate), 2);
$$;


--
-- Name: checkout_round_discount_amount(numeric, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.checkout_round_discount_amount(p_pre_amount numeric, p_discount_rate numeric) RETURNS numeric
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$
  select round(coalesce(p_pre_amount, 0) * public.checkout_discount_factor(p_discount_rate), 2);
$$;


--
-- Name: close_table_order_rounds_on_session_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.close_table_order_rounds_on_session_status() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('billing', 'closed') THEN
    UPDATE public.table_order_rounds
    SET
      status = 'closed',
      updated_at = now()
    WHERE session_id = NEW.id
      AND status IS DISTINCT FROM 'closed';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: close_table_session_manual(uuid, uuid, uuid, text, boolean, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.close_table_session_manual(p_restaurant_id uuid, p_table_id uuid, p_operator_user_id uuid, p_closed_reason text, p_confirm_close boolean, p_unpaid_reason text DEFAULT NULL::text, p_unpaid_reason_detail text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_session public.table_sessions%rowtype;
  v_table_name text;
  v_checkout_requested integer;
  v_gap jsonb;
  v_is_operator boolean;
  v_close_result jsonb;
  v_audit_snapshot jsonb;
BEGIN
  SELECT *
  INTO v_session
  FROM public.table_sessions
  WHERE restaurant_id = p_restaurant_id
    AND table_id = p_table_id
    AND status IN ('open', 'billing')
  ORDER BY opened_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'no_session');
  END IF;

  SELECT rt.display_name
  INTO v_table_name
  FROM public.restaurant_tables rt
  WHERE rt.restaurant_id = p_restaurant_id
    AND rt.id = v_session.table_id
    AND rt.deleted_at IS NULL;

  SELECT count(*)::integer
  INTO v_checkout_requested
  FROM public.bill_splits
  WHERE restaurant_id = p_restaurant_id
    AND session_id = v_session.id
    AND status = 'requested';

  IF NOT coalesce(p_confirm_close, false) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'close_confirm_required',
      'session_id', v_session.id,
      'reasons', jsonb_build_object('checkout_requested', v_checkout_requested)
    );
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.restaurants r
    WHERE r.id = p_restaurant_id
      AND r.owner_id = p_operator_user_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.restaurant_staff_accounts a
    WHERE a.restaurant_id = p_restaurant_id
      AND a.user_id = p_operator_user_id
      AND a.disabled_at IS NULL
  )
  INTO v_is_operator;

  IF NOT v_is_operator THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'forbidden',
      'message', 'unpaid_close_operator_forbidden'
    );
  END IF;

  v_gap := public.compute_session_payment_gap(p_restaurant_id, v_session.id);

  IF coalesce((v_gap->>'is_unpaid_close')::boolean, false) THEN
    IF nullif(btrim(coalesce(p_unpaid_reason, '')), '') IS NULL THEN
      RETURN jsonb_build_object(
        'ok', false,
        'code', 'reason_required',
        'session_id', v_session.id,
        'is_unpaid_close', true
      );
    END IF;
  END IF;

  v_audit_snapshot := jsonb_build_object(
    'session_id', v_session.id,
    'table_id', v_session.table_id,
    'table_name', v_table_name,
    'session_status_before', v_session.status,
    'table_status_before', v_session.status,
    'payable_amount', v_gap->'payable_amount',
    'paid_amount', v_gap->'paid_amount',
    'gap', v_gap->'gap',
    'has_unpaid_split', v_gap->'has_unpaid_split',
    'is_unpaid_close', v_gap->'is_unpaid_close',
    'session_status_after', 'closed',
    'table_status_after', 'closed'
  );

  v_close_result := public.close_table_session_operational(
    p_restaurant_id,
    p_table_id,
    p_closed_reason,
    p_operator_user_id
  );

  IF coalesce((v_close_result->>'ok')::boolean, false) IS NOT TRUE THEN
    RETURN v_close_result;
  END IF;

  RETURN v_close_result || jsonb_build_object(
    'is_unpaid_close', coalesce((v_gap->>'is_unpaid_close')::boolean, false),
    'audit_snapshot', v_audit_snapshot,
    'unpaid_reason', nullif(btrim(coalesce(p_unpaid_reason, '')), ''),
    'unpaid_reason_detail', nullif(btrim(coalesce(p_unpaid_reason_detail, '')), '')
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'update_failed',
      'message', SQLERRM
    );
END;
$$;


--
-- Name: FUNCTION close_table_session_manual(p_restaurant_id uuid, p_table_id uuid, p_operator_user_id uuid, p_closed_reason text, p_confirm_close boolean, p_unpaid_reason text, p_unpaid_reason_detail text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.close_table_session_manual(p_restaurant_id uuid, p_table_id uuid, p_operator_user_id uuid, p_closed_reason text, p_confirm_close boolean, p_unpaid_reason text, p_unpaid_reason_detail text) IS 'Manual unpaid/force close. Operator: restaurant owner_id or any active staff. App enforces tables.force_close.';


--
-- Name: close_table_session_operational(uuid, uuid, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.close_table_session_operational(p_restaurant_id uuid, p_table_id uuid, p_closed_reason text, p_closed_by_user_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_session public.table_sessions%rowtype;
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

  update public.bill_splits
  set status = 'cancelled'
  where restaurant_id = p_restaurant_id
    and session_id = v_session.id
    and status in ('pending', 'confirmed', 'requested');

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


--
-- Name: close_table_session_settled(uuid, uuid, text, uuid, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.close_table_session_settled(p_restaurant_id uuid, p_table_id uuid, p_closed_reason text, p_closed_by_user_id uuid DEFAULT NULL::uuid, p_settled_payable_amount numeric DEFAULT NULL::numeric) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_session public.table_sessions%rowtype;
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

  update public.bill_splits
     set status = 'cancelled'
   where restaurant_id = p_restaurant_id
     and session_id = v_session.id
     and status in ('pending', 'confirmed', 'requested');

  update public.table_sessions
     set
       status = 'closed',
       closed_at = v_now,
       closed_reason = p_closed_reason,
       closed_by_user_id = p_closed_by_user_id,
       settled_payable_amount = case
         when p_settled_payable_amount is null then settled_payable_amount
         else round(p_settled_payable_amount, 2)
       end
   where id = v_session.id;

  return jsonb_build_object(
    'ok', true,
    'session_id', v_session.id,
    'settled_payable_amount', (
      select settled_payable_amount
        from public.table_sessions
       where id = v_session.id
    )
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


--
-- Name: compute_session_payment_gap(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.compute_session_payment_gap(p_restaurant_id uuid, p_session_id uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_payable numeric := 0;
  v_paid numeric := 0;
  v_has_unpaid_split boolean := false;
  v_gap numeric;
  v_order record;
  v_split record;
begin
  for v_order in
    select items
    from public.orders
    where restaurant_id = p_restaurant_id
      and session_id = p_session_id
  loop
    v_payable := v_payable + public.recalc_order_total_from_items(v_order.items);
  end loop;

  select coalesce(sum(amount), 0)
  into v_paid
  from public.session_collected_payments
  where restaurant_id = p_restaurant_id
    and session_id = p_session_id;

  for v_split in
    select status
    from public.bill_splits
    where restaurant_id = p_restaurant_id
      and session_id = p_session_id
  loop
    if v_split.status in ('pending', 'confirmed', 'requested') then
      v_has_unpaid_split := true;
    end if;
  end loop;

  v_gap := greatest(v_payable - v_paid, 0);

  return jsonb_build_object(
    'payable_amount', v_payable,
    'paid_amount', v_paid,
    'gap', v_gap,
    'has_unpaid_split', v_has_unpaid_split,
    'is_unpaid_close', v_has_unpaid_split or v_gap > 0.0001
  );
end;
$$;


--
-- Name: confirm_bill_split_payment(uuid, uuid, uuid, numeric, uuid, text, boolean, jsonb, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.confirm_bill_split_payment(p_restaurant_id uuid, p_bill_split_id uuid, p_party_id uuid, p_collected_amount numeric DEFAULT NULL::numeric, p_created_by_user_id uuid DEFAULT NULL::uuid, p_payment_method text DEFAULT NULL::text, p_hold_open boolean DEFAULT false, p_payment_lines jsonb DEFAULT NULL::jsonb, p_client_request_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_split public.bill_splits%rowtype;
  v_raw_result jsonb;
  v_base_rows jsonb;
  v_persons jsonb;
  v_next_result jsonb;
  v_row jsonb;
  v_person jsonb;
  v_all_paid boolean := true;
  v_final_amount numeric := 0;
  v_i integer;
  v_len integer;
  v_person_index integer := -1;
  v_session public.table_sessions%rowtype;
  v_session_id uuid;
  v_precheck_status text;
  v_obligation numeric;
  v_collected numeric;
  v_prior_collected numeric;
  v_outstanding numeric;
  v_person_name text;
  v_payment_id uuid;
  v_payment_method text;
  v_payment_lines jsonb;
  v_line jsonb;
  v_line_sum numeric := 0;
  v_has_cash boolean := false;
  v_has_mb boolean := false;
  v_line_method text;
  v_line_amount numeric;
  v_pre_amounts numeric[];
  v_obligations numeric[];
  v_dup public.session_collected_payments%rowtype;
  v_party uuid;
  v_row_party uuid;
  v_stamped boolean := false;
  v_null_count integer := 0;
  v_null_idx integer := -1;
begin
  if p_party_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_party_id');
  end if;

  v_payment_method := upper(trim(coalesce(p_payment_method, '')));
  if v_payment_method = '' then
    v_payment_method := null;
  elsif v_payment_method not in ('CASH', 'MULTIBANCO', 'MIXED') then
    return jsonb_build_object('ok', false, 'code', 'invalid_payment_method');
  end if;

  v_payment_lines := p_payment_lines;
  if v_payment_method = 'MIXED' then
    if v_payment_lines is null or jsonb_typeof(v_payment_lines) <> 'array'
       or jsonb_array_length(v_payment_lines) < 2 then
      return jsonb_build_object('ok', false, 'code', 'missing_payment_lines');
    end if;
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

  if p_client_request_id is not null then
    select * into v_dup
    from public.session_collected_payments
    where restaurant_id = p_restaurant_id
      and client_request_id = p_client_request_id;
    if found then
      if v_dup.bill_split_id is distinct from p_bill_split_id
         or v_dup.party_id is distinct from p_party_id
         or (p_collected_amount is not null
             and round(v_dup.amount, 2) <> round(p_collected_amount, 2)) then
        return jsonb_build_object('ok', false, 'code', 'client_request_id_conflict');
      end if;
      v_next_result := coalesce(v_split.result, '[]'::jsonb);
      v_all_paid := v_split.status = 'paid';
      if v_all_paid and v_split.session_id is not null then
        v_final_amount := public.session_total_collected(p_restaurant_id, v_split.session_id);
      else
        select coalesce(sum((elem->>'amount')::numeric), 0)
        into v_final_amount
        from jsonb_array_elements(v_next_result) as elem;
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
        'row_name', v_dup.person_name,
        'row_amount', v_dup.amount,
        'collected_payment_id', v_dup.id,
        'confirmed_party_id', v_dup.party_id,
        'confirmed_person_index', v_dup.person_index,
        'payment_method', v_dup.payment_method,
        'payment_lines', v_dup.payment_lines,
        'newly_paid', false,
        'should_print_split', false,
        'should_print_final', false,
        'should_close_session', false
      );
    end if;
  end if;

  v_raw_result := coalesce(v_split.result, '[]'::jsonb);
  if jsonb_typeof(v_raw_result) <> 'array' then
    v_raw_result := '[]'::jsonb;
  end if;
  v_persons := coalesce(v_split.persons, '[]'::jsonb);
  if jsonb_typeof(v_persons) <> 'array' then
    v_persons := '[]'::jsonb;
  end if;

  if jsonb_array_length(v_raw_result) = 0 then
    if coalesce(v_split.total_amount, 0) > 0 then
      v_base_rows := jsonb_build_array(
        jsonb_build_object(
          'name', 'Total',
          'amount', v_split.total_amount,
          'party_id', p_party_id::text
        )
      );
      v_stamped := true;
    else
      return jsonb_build_object('ok', false, 'code', 'empty_split');
    end if;
  else
    v_base_rows := v_raw_result;
  end if;

  v_len := jsonb_array_length(v_base_rows);

  -- Locate by party_id; if one seat has no id, stamp caller's p_party_id onto it.
  for v_i in 0 .. v_len - 1 loop
    v_row := v_base_rows -> v_i;
    begin
      v_row_party := nullif(btrim(coalesce(v_row ->> 'party_id', '')), '')::uuid;
    exception
      when others then
        v_row_party := null;
    end;
    if v_row_party = p_party_id then
      v_person_index := v_i;
      exit;
    end if;
  end loop;

  -- At most one seat without id may receive the caller's p_party_id (whole-table / legacy).
  if v_person_index < 0 then
    v_null_count := 0;
    v_null_idx := -1;
    for v_i in 0 .. v_len - 1 loop
      v_row := v_base_rows -> v_i;
      begin
        v_row_party := nullif(btrim(coalesce(v_row ->> 'party_id', '')), '')::uuid;
      exception
        when others then
          v_row_party := null;
      end;
      if v_row_party is null then
        v_null_count := v_null_count + 1;
        v_null_idx := v_i;
      end if;
    end loop;
    if v_null_count = 1 or (v_len = 1 and v_null_idx >= 0) then
      v_i := v_null_idx;
      v_base_rows := jsonb_set(
        v_base_rows,
        array[v_i::text],
        (v_base_rows -> v_i) || jsonb_build_object('party_id', p_party_id::text),
        true
      );
      if v_i < jsonb_array_length(v_persons) then
        v_persons := jsonb_set(
          v_persons,
          array[v_i::text],
          (v_persons -> v_i) || jsonb_build_object('party_id', p_party_id::text),
          true
        );
      end if;
      v_person_index := v_i;
      v_stamped := true;
    end if;
  end if;

  if v_person_index < 0 then
    return jsonb_build_object('ok', false, 'code', 'invalid_party_id');
  end if;

  if v_stamped then
    update public.bill_splits
    set result = v_base_rows,
        persons = case
          when jsonb_array_length(v_persons) > 0 then v_persons
          else persons
        end
    where id = p_bill_split_id;
  end if;

  v_pre_amounts := array[]::numeric[];
  for v_i in 0 .. v_len - 1 loop
    v_row := v_base_rows -> v_i;
    v_pre_amounts := array_append(v_pre_amounts, coalesce((v_row ->> 'amount')::numeric, 0));
  end loop;

  v_obligations := public.checkout_allocate_discounted_obligations(
    v_pre_amounts,
    v_split.discount_rate,
    v_split.total_amount,
    null
  );

  v_row := v_base_rows -> v_person_index;
  v_person_name := coalesce(v_row ->> 'name', '');
  v_obligation := v_obligations[v_person_index + 1];
  v_party := p_party_id;

  if v_split.session_id is not null then
    v_prior_collected := public.session_seat_collected(
      p_restaurant_id,
      v_split.session_id,
      v_person_index,
      v_party
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

  if v_payment_method = 'MIXED' then
    for v_i in 0 .. jsonb_array_length(v_payment_lines) - 1 loop
      v_line := v_payment_lines -> v_i;
      v_line_method := upper(trim(coalesce(v_line ->> 'method', '')));
      v_line_amount := coalesce((v_line ->> 'amount')::numeric, 0);
      if v_line_method not in ('CASH', 'MULTIBANCO') or v_line_amount <= 0 then
        return jsonb_build_object('ok', false, 'code', 'invalid_payment_lines');
      end if;
      if v_line_method = 'CASH' then v_has_cash := true; end if;
      if v_line_method = 'MULTIBANCO' then v_has_mb := true; end if;
      v_line_sum := v_line_sum + v_line_amount;
    end loop;
    if not v_has_cash or not v_has_mb then
      return jsonb_build_object('ok', false, 'code', 'invalid_payment_lines');
    end if;
    if round(v_line_sum, 2) <> round(v_collected, 2) then
      return jsonb_build_object('ok', false, 'code', 'payment_lines_amount_mismatch');
    end if;
  end if;

  if v_split.session_id is not null then
    insert into public.session_collected_payments (
      restaurant_id,
      session_id,
      party_id,
      person_index,
      person_name,
      amount,
      bill_split_id,
      created_by_user_id,
      payment_method,
      payment_lines,
      client_request_id
    ) values (
      p_restaurant_id,
      v_split.session_id,
      v_party,
      v_person_index,
      v_person_name,
      v_collected,
      p_bill_split_id,
      p_created_by_user_id,
      v_payment_method,
      v_payment_lines,
      p_client_request_id
    )
    returning id into v_payment_id;
  end if;

  v_next_result := public.reconcile_split_result_paid_from_ledger(
    v_base_rows,
    p_restaurant_id,
    v_split.session_id,
    v_split.discount_rate
  );

  v_pre_amounts := array[]::numeric[];
  for v_i in 0 .. v_len - 1 loop
    v_row := v_next_result -> v_i;
    v_pre_amounts := array_append(v_pre_amounts, coalesce((v_row ->> 'amount')::numeric, 0));
  end loop;
  v_obligations := public.checkout_allocate_discounted_obligations(
    v_pre_amounts,
    v_split.discount_rate,
    v_split.total_amount,
    null
  );
  for v_i in 0 .. v_len - 1 loop
    v_obligation := v_obligations[v_i + 1];
    if coalesce(v_obligation, 0) <= 0 then
      continue;
    end if;
    if not coalesce((v_next_result -> v_i ->> 'paid')::boolean, false) then
      v_all_paid := false;
      exit;
    end if;
  end loop;

  if coalesce(p_hold_open, false) then
    v_all_paid := false;
  end if;

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
    total_amount = v_split.total_amount,
    result = v_next_result
  where id = p_bill_split_id;

  v_row := v_next_result -> v_person_index;

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
    'confirmed_party_id', v_party,
    'confirmed_person_index', v_person_index,
    'payment_method', v_payment_method,
    'payment_lines', v_payment_lines,
    'newly_paid', true,
    'should_print_split', false,
    'should_print_final', false,
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


--
-- Name: dashboard_overview_revenue_bundle(uuid, timestamp with time zone, timestamp with time zone, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.dashboard_overview_revenue_bundle(p_restaurant_id uuid, p_start_utc timestamp with time zone, p_end_exclusive_utc timestamp with time zone, p_max_sessions integer DEFAULT 2000) RETURNS jsonb
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public'
    AS $$
declare
  v_session_count integer;
  v_sessions jsonb;
  v_orders jsonb;
  v_splits jsonb;
  v_unpaid jsonb;
begin
  select count(*)::integer
    into v_session_count
    from public.table_sessions ts
   where ts.restaurant_id = p_restaurant_id
     and ts.status = 'closed'
     and ts.closed_at is not null
     and ts.closed_at >= p_start_utc
     and ts.closed_at < p_end_exclusive_utc;

  if v_session_count > greatest(coalesce(p_max_sessions, 2000), 1) then
    return jsonb_build_object(
      'ok', false,
      'code', 'query_limit_exceeded',
      'session_count', v_session_count
    );
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', ts.id,
        'closed_at', ts.closed_at,
        'closed_reason', ts.closed_reason,
        'settled_payable_amount', ts.settled_payable_amount
      )
      order by ts.closed_at
    ),
    '[]'::jsonb
  )
    into v_sessions
    from public.table_sessions ts
   where ts.restaurant_id = p_restaurant_id
     and ts.status = 'closed'
     and ts.closed_at is not null
     and ts.closed_at >= p_start_utc
     and ts.closed_at < p_end_exclusive_utc;

  if v_session_count = 0 then
    return jsonb_build_object(
      'ok', true,
      'sessions', '[]'::jsonb,
      'orders', '[]'::jsonb,
      'splits', '[]'::jsonb,
      'unpaid_session_ids', '[]'::jsonb
    );
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', o.id,
        'session_id', o.session_id,
        'status', o.status,
        'total_amount', o.total_amount
      )
    ),
    '[]'::jsonb
  )
    into v_orders
    from public.orders o
   where o.restaurant_id = p_restaurant_id
     and o.session_id in (
       select ts.id
         from public.table_sessions ts
        where ts.restaurant_id = p_restaurant_id
          and ts.status = 'closed'
          and ts.closed_at is not null
          and ts.closed_at >= p_start_utc
          and ts.closed_at < p_end_exclusive_utc
     );

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', bs.id,
        'session_id', bs.session_id,
        'status', bs.status,
        'result', bs.result,
        'total_amount', bs.total_amount,
        'discount_rate', bs.discount_rate
      )
    ),
    '[]'::jsonb
  )
    into v_splits
    from public.bill_splits bs
   where bs.restaurant_id = p_restaurant_id
     and bs.session_id in (
       select ts.id
         from public.table_sessions ts
        where ts.restaurant_id = p_restaurant_id
          and ts.status = 'closed'
          and ts.closed_at is not null
          and ts.closed_at >= p_start_utc
          and ts.closed_at < p_end_exclusive_utc
     );

  select coalesce(jsonb_agg(distinct ao.session_id), '[]'::jsonb)
    into v_unpaid
    from public.abnormal_operations ao
   where ao.restaurant_id = p_restaurant_id
     and ao.type = 'UNPAID_TABLE_CLOSED'
     and ao.session_id in (
       select ts.id
         from public.table_sessions ts
        where ts.restaurant_id = p_restaurant_id
          and ts.status = 'closed'
          and ts.closed_at is not null
          and ts.closed_at >= p_start_utc
          and ts.closed_at < p_end_exclusive_utc
     );

  return jsonb_build_object(
    'ok', true,
    'sessions', v_sessions,
    'orders', v_orders,
    'splits', v_splits,
    'unpaid_session_ids', v_unpaid
  );
end;
$$;


--
-- Name: delete_table_order_round_line(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_table_order_round_line(p_session_id uuid, p_guest_client_id uuid, p_line_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_round public.table_order_rounds%ROWTYPE;
  v_line public.table_order_round_lines%ROWTYPE;
  v_now timestamptz := now();
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_session_id::text));

  SELECT *
  INTO v_round
  FROM public.table_order_rounds
  WHERE session_id = p_session_id
    AND status IN ('collecting', 'pending_confirm', 'cooldown', 'finalize_failed')
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'round_not_found');
  END IF;
  IF v_round.status = 'finalize_failed' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'round_basket_locked');
  END IF;
  IF v_round.status NOT IN ('collecting', 'pending_confirm') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'round_not_collecting');
  END IF;

  SELECT *
  INTO v_line
  FROM public.table_order_round_lines
  WHERE id = p_line_id
    AND round_id = v_round.id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'line_not_found');
  END IF;
  IF v_line.guest_client_id <> p_guest_client_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'line_not_owned');
  END IF;

  DELETE FROM public.table_order_round_lines WHERE id = p_line_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;


--
-- Name: FUNCTION delete_table_order_round_line(p_session_id uuid, p_guest_client_id uuid, p_line_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.delete_table_order_round_line(p_session_id uuid, p_guest_client_id uuid, p_line_id uuid) IS 'Sole guest round-line delete under the same session advisory lock as upsert.';


--
-- Name: enforce_kitchen_screen_station_limit(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_kitchen_screen_station_limit() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  cnt integer;
BEGIN
  SELECT count(*) INTO cnt
  FROM public.kitchen_screen_stations
  WHERE screen_id = NEW.screen_id;
  IF TG_OP = 'INSERT' AND cnt >= 4 THEN
    RAISE EXCEPTION 'kitchen_screen_station_limit'
      USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.screen_id IS DISTINCT FROM OLD.screen_id THEN
    SELECT count(*) INTO cnt
    FROM public.kitchen_screen_stations
    WHERE screen_id = NEW.screen_id;
    IF cnt >= 4 THEN
      RAISE EXCEPTION 'kitchen_screen_station_limit'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: enforce_menu_note_preset_same_restaurant(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_menu_note_preset_same_restaurant() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.menu_note_preset_groups g
    WHERE g.id = NEW.group_id
      AND g.restaurant_id = NEW.restaurant_id
  ) THEN
    RAISE EXCEPTION 'invalid_note_preset_group';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: enforce_menu_recommended_item_same_restaurant(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_menu_recommended_item_same_restaurant() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.menu_items mi
    WHERE mi.id = NEW.menu_item_id
      AND mi.restaurant_id = NEW.restaurant_id
  ) THEN
    RAISE EXCEPTION 'invalid_recommended_menu_item';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: enforce_print_station_same_restaurant(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_print_station_same_restaurant() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if new.print_station_id is null then
    return new;
  end if;
  if not exists (
    select 1
    from public.print_stations ps
    where ps.id = new.print_station_id
      and ps.restaurant_id = new.restaurant_id
  ) then
    raise exception 'print_station_id must reference print_stations for the same restaurant';
  end if;
  return new;
end;
$$;


--
-- Name: enforce_table_group_member_same_restaurant(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_table_group_member_same_restaurant() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_group_restaurant uuid;
BEGIN
  SELECT g.restaurant_id
  INTO v_group_restaurant
  FROM public.restaurant_table_groups g
  WHERE g.id = NEW.group_id;

  IF v_group_restaurant IS NULL
    OR v_group_restaurant <> NEW.restaurant_id
    OR NOT EXISTS (
      SELECT 1
      FROM public.restaurant_tables rt
      WHERE rt.id = NEW.table_id
        AND rt.restaurant_id = NEW.restaurant_id
        AND rt.deleted_at IS NULL
    )
  THEN
    RAISE EXCEPTION 'invalid_table_group_member';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: enforce_table_party_member_same_restaurant(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_table_party_member_same_restaurant() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_party_restaurant uuid;
BEGIN
  SELECT g.restaurant_id
  INTO v_party_restaurant
  FROM public.table_party_groups g
  WHERE g.id = NEW.party_id;

  IF v_party_restaurant IS NULL
    OR v_party_restaurant <> NEW.restaurant_id
    OR NOT EXISTS (
      SELECT 1
      FROM public.restaurant_tables rt
      WHERE rt.id = NEW.table_id
        AND rt.restaurant_id = NEW.restaurant_id
        AND rt.deleted_at IS NULL
    )
  THEN
    RAISE EXCEPTION 'invalid_table_party_member';
  END IF;

  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: restaurant_tables; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.restaurant_tables (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    display_name text NOT NULL,
    sort_order integer NOT NULL,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    seat_min integer DEFAULT 2 NOT NULL,
    seat_max integer DEFAULT 4 NOT NULL,
    CONSTRAINT restaurant_tables_display_name_len CHECK (((char_length(display_name) >= 1) AND (char_length(display_name) <= 16))),
    CONSTRAINT restaurant_tables_seat_max_range CHECK (((seat_max >= 1) AND (seat_max <= 99))),
    CONSTRAINT restaurant_tables_seat_min_range CHECK (((seat_min >= 1) AND (seat_min <= 99))),
    CONSTRAINT restaurant_tables_seat_range_valid CHECK ((seat_min <= seat_max))
);


--
-- Name: get_active_restaurant_table(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_active_restaurant_table(p_restaurant_id uuid, p_table_id uuid) RETURNS public.restaurant_tables
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select rt.*
  from public.restaurant_tables rt
  where rt.restaurant_id = p_restaurant_id
    and rt.id = p_table_id
    and rt.deleted_at is null
  limit 1;
$$;


--
-- Name: handle_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: individual_checkout_apply(uuid, uuid, uuid, text, uuid[], text, text, uuid, text[], integer, jsonb, jsonb, numeric, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.individual_checkout_apply(p_restaurant_id uuid, p_session_id uuid, p_table_id uuid, p_display_name text, p_order_ids uuid[], p_action text, p_actor text, p_client_id uuid, p_party_keys text[], p_base_revision integer, p_persons jsonb, p_result jsonb, p_total_amount numeric, p_ticket_signal_items jsonb DEFAULT '{}'::jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
        if public.session_seat_collected(
          p_restaurant_id,
          p_session_id,
          v_i,
          nullif(btrim(coalesce(v_old_row ->> 'party_id', '')), '')::uuid
        ) > 0 then
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
    -- Drop each unpaid ticket from persons + result. Ledger rows keep party_id; no index shift.
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
  then
    if exists (
      select 1
      from public.session_collected_payments scp
      where scp.restaurant_id = p_restaurant_id
        and scp.session_id = p_session_id
    ) then
      -- Money already collected: sole stamp via mark_bill_split_staff_checkout
      -- (same writer as floor ensure-entry / held-open collect) so refresh keeps requested.
      perform public.mark_bill_split_staff_checkout(p_restaurant_id, v_split_id);
    else
      -- Nobody waiting and nothing collected: release the table from the queue.
      update public.bill_splits
      set staff_checkout_requested_at = null
      where id = v_split_id;
    end if;
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


--
-- Name: individual_refresh_split_status(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.individual_refresh_split_status(p_split_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_status text;
  v_split_mode text;
  v_staff_requested boolean;
  v_next text;
begin
  select status, split_mode, staff_checkout_requested_at is not null
  into v_status, v_split_mode, v_staff_requested
  from public.bill_splits
  where id = p_split_id;
  if v_status is null or v_status not in ('pending', 'confirmed', 'requested') then
    return;
  end if;
  if coalesce(v_split_mode, '') <> 'by_item' then
    return;
  end if;
  v_next := case
    when v_staff_requested then 'requested'
    when public.individual_split_has_called_unpaid(p_split_id) then 'requested'
    else 'confirmed'
  end;
  if v_status is distinct from v_next then
    update public.bill_splits set status = v_next where id = p_split_id;
  end if;
end;
$$;


--
-- Name: individual_split_has_called_unpaid(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.individual_split_has_called_unpaid(p_split_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.bill_splits s
    cross join lateral jsonb_array_elements(coalesce(s.result, '[]'::jsonb)) as r(row)
    join public.bill_split_ticket_calls c
      on c.bill_split_id = s.id
     and c.state = 'called'
     and c.ticket_key = public.individual_ticket_key(r.row)
    where s.id = p_split_id
      and not coalesce((r.row ->> 'paid')::boolean, false)
  );
$$;


--
-- Name: individual_ticket_key(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.individual_ticket_key(p_row jsonb) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  select case
    when btrim(coalesce(p_row ->> 'party_id', '')) <> ''
      then 'p:' || btrim(p_row ->> 'party_id')
    when btrim(coalesce(p_row ->> 'name', '')) <> ''
      then 'n:' || lower(btrim(p_row ->> 'name'))
    else ''
  end;
$$;


--
-- Name: is_active_restaurant_staff(uuid, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_active_restaurant_staff(p_restaurant_id uuid, p_roles text[] DEFAULT ARRAY['kitchen'::text, 'waiter'::text]) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.restaurant_staff_accounts a
    LEFT JOIN public.restaurant_roles rr ON rr.id = a.role_id
    WHERE a.restaurant_id = p_restaurant_id
      AND a.user_id = auth.uid()
      AND a.disabled_at IS NULL
      AND a.role = ANY (p_roles)
      AND (
        a.role = 'print_agent'
        OR (a.role_id IS NOT NULL AND rr.disabled_at IS NULL)
      )
  );
$$;


--
-- Name: mark_bill_split_staff_checkout(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_bill_split_staff_checkout(p_restaurant_id uuid, p_bill_split_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  update public.bill_splits
  set staff_checkout_requested_at = coalesce(staff_checkout_requested_at, now())
  where id = p_bill_split_id
    and restaurant_id = p_restaurant_id
    and status in ('pending', 'confirmed', 'requested');
  return found;
end;
$$;


--
-- Name: merge_by_item_split_result_with_ledger(jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.merge_by_item_split_result_with_ledger(p_incoming jsonb, p_existing jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
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
  v_paid boolean;
  v_ex_paid boolean;
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
    v_ex_paid := coalesce((v_ex_row ->> 'paid')::boolean, false);
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
      -- Keep paid tickets in place even when incoming omits them.
      if v_ex_paid then
        v_result := v_result || jsonb_build_array(v_ex_row);
      end if;
      continue;
    end if;

    v_paid :=
      v_ex_paid
      or coalesce((v_inc_row ->> 'paid')::boolean, false);

    v_row := v_ex_row || jsonb_build_object(
      'amount',
        case
          when v_paid then (v_ex_row ->> 'amount')::numeric
          else (v_inc_row ->> 'amount')::numeric
        end,
      'paid', v_paid
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


--
-- Name: merge_even_split_result_with_ledger(jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.merge_even_split_result_with_ledger(p_incoming jsonb, p_existing jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
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


--
-- Name: merge_multiple_table_sessions(uuid, uuid[], uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.merge_multiple_table_sessions(p_restaurant_id uuid, p_source_table_ids uuid[], p_target_table_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_source_id uuid;
  v_target_session_id uuid;
begin
  if p_source_table_ids is null or array_length(p_source_table_ids, 1) is null then
    raise exception 'source tables cannot be empty';
  end if;

  if p_target_table_id = any(p_source_table_ids) then
    raise exception 'target cannot be among sources';
  end if;

  foreach v_source_id in array p_source_table_ids loop
    v_target_session_id := public.merge_table_sessions(
      p_restaurant_id,
      v_source_id,
      p_target_table_id
    );
  end loop;

  return v_target_session_id;
end;
$$;


--
-- Name: merge_multiple_table_sessions(uuid, uuid[], uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.merge_multiple_table_sessions(p_restaurant_id uuid, p_source_table_ids uuid[], p_target_table_id uuid, p_operator_user_id uuid DEFAULT NULL::uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: merge_split_result_paid(jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.merge_split_result_paid(p_incoming jsonb, p_existing jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
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


--
-- Name: merge_split_result_with_ledger(jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.merge_split_result_with_ledger(p_incoming jsonb, p_existing jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
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


--
-- Name: merge_table_sessions(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.merge_table_sessions(p_restaurant_id uuid, p_source_table_id uuid, p_target_table_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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
begin
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
      merge_into_session_id = v_target_session.id
  where id = v_source_session.id;

  return v_target_session.id;
end;
$_$;


--
-- Name: merge_table_sessions(uuid, uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.merge_table_sessions(p_restaurant_id uuid, p_source_table_id uuid, p_target_table_id uuid, p_operator_user_id uuid DEFAULT NULL::uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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
$_$;


--
-- Name: order_history_feed_page(uuid, timestamp with time zone, timestamp with time zone, uuid[], uuid, boolean, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.order_history_feed_page(p_restaurant_id uuid, p_closed_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_closed_to timestamp with time zone DEFAULT NULL::timestamp with time zone, p_table_ids uuid[] DEFAULT NULL::uuid[], p_session_id uuid DEFAULT NULL::uuid, p_include_transfers boolean DEFAULT true, p_offset integer DEFAULT 0, p_limit integer DEFAULT 10) RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  WITH closed_rows AS (
    SELECT
      'closed'::text AS kind,
      ts.closed_at AS sort_at,
      ts.id AS session_id,
      NULL::uuid AS event_id,
      jsonb_build_object(
        'id', ts.id,
        'table_id', ts.table_id,
        'opened_at', ts.opened_at,
        'closed_at', ts.closed_at,
        'closed_reason', ts.closed_reason,
        'settled_payable_amount', ts.settled_payable_amount,
        'opened_by_user_id', ts.opened_by_user_id,
        'opened_by_name', ts.opened_by_name,
        'closed_by_user_id', ts.closed_by_user_id,
        'merge_into_session_id', ts.merge_into_session_id
      ) AS payload
    FROM public.table_sessions ts
    WHERE ts.restaurant_id = p_restaurant_id
      AND ts.status = 'closed'
      AND (p_session_id IS NULL OR ts.id = p_session_id)
      AND (p_closed_from IS NULL OR ts.closed_at >= p_closed_from)
      AND (p_closed_to IS NULL OR ts.closed_at <= p_closed_to)
      AND (
        p_table_ids IS NULL
        OR cardinality(p_table_ids) = 0
        OR ts.table_id = ANY (p_table_ids)
      )
  ),
  transfer_rows AS (
    SELECT
      'transfer'::text AS kind,
      e.occurred_at AS sort_at,
      e.session_id AS session_id,
      e.id AS event_id,
      jsonb_build_object(
        'id', e.id,
        'session_id', e.session_id,
        'occurred_at', e.occurred_at,
        'operator_user_id', e.operator_user_id,
        'from_table_id', e.from_table_id,
        'to_table_id', e.to_table_id,
        'from_display_name', e.from_display_name,
        'to_display_name', e.to_display_name
      ) AS payload
    FROM public.table_session_events e
    WHERE p_include_transfers
      AND p_session_id IS NULL
      AND e.restaurant_id = p_restaurant_id
      AND e.event_type = 'transfer'
      AND (p_closed_from IS NULL OR e.occurred_at >= p_closed_from)
      AND (p_closed_to IS NULL OR e.occurred_at <= p_closed_to)
      AND (
        p_table_ids IS NULL
        OR cardinality(p_table_ids) = 0
        OR e.from_table_id = ANY (p_table_ids)
      )
  ),
  feed AS (
    SELECT * FROM closed_rows
    UNION ALL
    SELECT * FROM transfer_rows
  ),
  counted AS (
    SELECT count(*)::integer AS total FROM feed
  ),
  page_rows AS (
    SELECT
      f.kind,
      f.sort_at,
      f.session_id,
      f.event_id,
      f.payload
    FROM feed f
    ORDER BY f.sort_at DESC, f.kind ASC, coalesce(f.event_id, f.session_id) ASC
    OFFSET greatest(coalesce(p_offset, 0), 0)
    LIMIT greatest(least(coalesce(p_limit, 10), 50), 1)
  ),
  page AS (
    SELECT coalesce(
      jsonb_agg(
        jsonb_build_object(
          'kind', pr.kind,
          'sort_at', pr.sort_at,
          'session_id', pr.session_id,
          'event_id', pr.event_id,
          'payload', pr.payload
        )
        ORDER BY pr.sort_at DESC, pr.kind ASC, coalesce(pr.event_id, pr.session_id) ASC
      ),
      '[]'::jsonb
    ) AS items
    FROM page_rows pr
  )
  SELECT jsonb_build_object(
    'total', counted.total,
    'items', page.items
  )
  FROM counted, page;
$$;


--
-- Name: FUNCTION order_history_feed_page(p_restaurant_id uuid, p_closed_from timestamp with time zone, p_closed_to timestamp with time zone, p_table_ids uuid[], p_session_id uuid, p_include_transfers boolean, p_offset integer, p_limit integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.order_history_feed_page(p_restaurant_id uuid, p_closed_from timestamp with time zone, p_closed_to timestamp with time zone, p_table_ids uuid[], p_session_id uuid, p_include_transfers boolean, p_offset integer, p_limit integer) IS 'Dashboard order-history merged feed (closed + transfer-out) with DB pagination; service_role only.';


--
-- Name: purge_table_group_member_on_soft_delete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.purge_table_group_member_on_soft_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    DELETE FROM public.restaurant_table_group_members
    WHERE table_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: purge_table_party_member_on_soft_delete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.purge_table_party_member_on_soft_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    DELETE FROM public.table_party_group_members
    WHERE table_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: recalc_order_total_from_items(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.recalc_order_total_from_items(p_items jsonb) RETURNS numeric
    LANGUAGE sql IMMUTABLE
    AS $$
  select coalesce(sum(
    (elem->>'price')::numeric * coalesce(nullif(elem->>'qty', '')::numeric, 1::numeric)
  ), 0::numeric)
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) elem
  where coalesce(elem->>'item_status', 'pending') <> 'voided';
$$;


--
-- Name: reconcile_split_result_paid_from_ledger(jsonb, uuid, uuid, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reconcile_split_result_paid_from_ledger(p_result jsonb, p_restaurant_id uuid, p_session_id uuid, p_discount_rate numeric DEFAULT 0) RETURNS jsonb
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public'
    AS $$
declare
  v_result jsonb := '[]'::jsonb;
  v_row jsonb;
  v_len integer;
  v_i integer;
  v_obligation numeric;
  v_collected numeric;
  v_pre_amounts numeric[];
  v_obligations numeric[];
  v_bill_pre numeric;
  v_party uuid;
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

  v_pre_amounts := array[]::numeric[];
  v_bill_pre := 0;
  for v_i in 0 .. v_len - 1 loop
    v_row := p_result -> v_i;
    v_pre_amounts := array_append(v_pre_amounts, coalesce((v_row ->> 'amount')::numeric, 0));
    v_bill_pre := v_bill_pre + coalesce((v_row ->> 'amount')::numeric, 0);
  end loop;

  v_obligations := public.checkout_allocate_discounted_obligations(
    v_pre_amounts,
    p_discount_rate,
    v_bill_pre,
    null
  );

  for v_i in 0 .. v_len - 1 loop
    v_row := p_result -> v_i;
    v_obligation := v_obligations[v_i + 1];
    begin
      v_party := nullif(btrim(coalesce(v_row ->> 'party_id', '')), '')::uuid;
    exception
      when others then
        v_party := null;
    end;
    v_collected := public.session_seat_collected(
      p_restaurant_id,
      p_session_id,
      v_i,
      v_party
    );
    v_row := v_row || jsonb_build_object(
      'paid',
      round(v_collected, 2) >= round(coalesce(v_obligation, 0), 2)
    );
    v_result := v_result || jsonb_build_array(v_row);
  end loop;

  return v_result;
end;
$$;


--
-- Name: FUNCTION reconcile_split_result_paid_from_ledger(p_result jsonb, p_restaurant_id uuid, p_session_id uuid, p_discount_rate numeric); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.reconcile_split_result_paid_from_ledger(p_result jsonb, p_restaurant_id uuid, p_session_id uuid, p_discount_rate numeric) IS 'Stamp result[].paid from ledger via session_seat_collected (party_id first).';


--
-- Name: replace_table_group_members(uuid, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.replace_table_group_members(p_group_id uuid, p_table_ids uuid[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_restaurant_id uuid;
BEGIN
  SELECT g.restaurant_id
  INTO v_restaurant_id
  FROM public.restaurant_table_groups g
  WHERE g.id = p_group_id;

  IF v_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'group_not_found';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.restaurants r
    WHERE r.id = v_restaurant_id
      AND r.owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_table_ids IS NOT NULL AND cardinality(p_table_ids) > 0 THEN
    IF EXISTS (
      SELECT 1
      FROM public.restaurant_tables rt
      WHERE rt.id = ANY (p_table_ids)
        AND (rt.restaurant_id <> v_restaurant_id OR rt.deleted_at IS NOT NULL)
    ) THEN
      RAISE EXCEPTION 'invalid_table_ids';
    END IF;

    DELETE FROM public.restaurant_table_group_members
    WHERE restaurant_id = v_restaurant_id
      AND table_id = ANY (p_table_ids);
  END IF;

  DELETE FROM public.restaurant_table_group_members
  WHERE group_id = p_group_id;

  IF p_table_ids IS NOT NULL AND cardinality(p_table_ids) > 0 THEN
    INSERT INTO public.restaurant_table_group_members (group_id, table_id, restaurant_id)
    SELECT p_group_id, tid, v_restaurant_id
    FROM unnest(p_table_ids) AS tid;
  END IF;
END;
$$;


--
-- Name: resolve_buffet_prices(uuid, uuid, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.resolve_buffet_prices(p_restaurant_id uuid, p_buffet_id uuid, p_at timestamp with time zone DEFAULT now()) RETURNS TABLE(adult_price numeric, child_price numeric, rule_id uuid, time_slot_id uuid)
    LANGUAGE plpgsql STABLE
    AS $$
declare
  v_tz text := 'Europe/Lisbon';
  v_date date;
  v_t time;
  v_dow int;
  v_override text;
  v_cal text;
  v_slot_id uuid;
  v_friday_from time;
begin
  v_date := (p_at at time zone v_tz)::date;
  v_t := (p_at at time zone v_tz)::time;
  v_dow := extract(dow from (p_at at time zone v_tz))::int;

  select r.buffet_friday_weekend_from into v_friday_from
  from public.restaurants r
  where r.id = p_restaurant_id;

  select bco.kind into v_override
  from public.buffet_calendar_overrides bco
  where bco.restaurant_id = p_restaurant_id
    and bco.on_date = v_date;

  if v_override = 'holiday' then
    v_cal := 'holiday';
  elsif v_override = 'special' then
    v_cal := 'special';
  elsif v_dow in (0, 6) then
    v_cal := 'weekend';
  else
    v_cal := 'weekday';
  end if;

  if v_cal = 'weekday'
    and v_dow = 5
    and v_friday_from is not null
    and v_t >= v_friday_from
  then
    v_cal := 'weekend';
  end if;

  select s.id into v_slot_id
  from (
    select
      ts.id,
      case
        when ts.start_time <= ts.end_time
          and v_t >= ts.start_time
          and v_t < ts.end_time
        then 0::double precision
        when ts.start_time > ts.end_time
          and (v_t >= ts.start_time or v_t < ts.end_time)
        then 0::double precision
        when ts.start_time <= ts.end_time
          and v_t < ts.start_time
        then extract(epoch from (ts.start_time - v_t))
        when ts.start_time <= ts.end_time
          and v_t >= ts.end_time
        then extract(epoch from (v_t - ts.end_time))
        else
          86400::double precision
      end as dist,
      ts.sort_order,
      ts.name
    from public.buffet_time_slots ts
    where ts.restaurant_id = p_restaurant_id
      and v_dow = any (ts.weekdays)
      and exists (
        select 1
        from public.buffet_price_rules r
        where r.time_slot_id = ts.id
          and r.restaurant_id = p_restaurant_id
          and r.buffet_id = p_buffet_id
          and r.calendar_kind = v_cal
          and r.is_active
          and v_date between r.valid_from and r.valid_to
      )
  ) s
  order by s.dist asc, s.sort_order asc, s.name asc
  limit 1;

  if v_slot_id is null then
    return query select null::numeric, null::numeric, null::uuid, null::uuid;
    return;
  end if;

  return query
  select r.adult_price, r.child_price, r.id, r.time_slot_id
  from public.buffet_price_rules r
  where r.restaurant_id = p_restaurant_id
    and r.buffet_id = p_buffet_id
    and r.time_slot_id = v_slot_id
    and r.calendar_kind = v_cal
    and r.is_active
    and v_date between r.valid_from and r.valid_to
  order by r.priority desc, r.valid_from desc
  limit 1;
end;
$$;


--
-- Name: resume_table_session_ordering(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.resume_table_session_ordering(p_restaurant_id uuid, p_table_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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

    if coalesce(v_split.split_mode, '') = 'by_item' then
      null;
    elsif v_len <= 1 and v_has_partial_payment then
      return jsonb_build_object('ok', false, 'code', 'whole_table_paid');
    end if;

    v_preserve_split := v_split.split_mode = 'by_item' or v_has_partial_payment;

    if v_preserve_split then
      update public.bill_splits
      set
        status = 'confirmed',
        staff_checkout_requested_at = null,
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
      set status = 'cancelled',
          staff_checkout_requested_at = null
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


--
-- Name: rls_auto_enable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


--
-- Name: seed_default_menu_note_presets(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.seed_default_menu_note_presets(p_restaurant_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  g_spice uuid;
  g_salt uuid;
  g_oil uuid;
  g_sugar uuid;
  g_temp uuid;
  g_doneness uuid;
  g_sauce uuid;
  g_pack uuid;
  g_utensils uuid;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.menu_note_preset_groups WHERE restaurant_id = p_restaurant_id LIMIT 1
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.menu_note_preset_groups (restaurant_id, name_en, name_pt, name_zh, sort_order)
  VALUES (p_restaurant_id, 'Spice level', 'Picante', '辣度', 0)
  RETURNING id INTO g_spice;

  INSERT INTO public.menu_note_preset_groups (restaurant_id, name_en, name_pt, name_zh, sort_order)
  VALUES (p_restaurant_id, 'Salt', 'Sal', '盐', 1)
  RETURNING id INTO g_salt;

  INSERT INTO public.menu_note_preset_groups (restaurant_id, name_en, name_pt, name_zh, sort_order)
  VALUES (p_restaurant_id, 'Oil', 'Oleo', '油', 2)
  RETURNING id INTO g_oil;

  INSERT INTO public.menu_note_preset_groups (restaurant_id, name_en, name_pt, name_zh, sort_order)
  VALUES (p_restaurant_id, 'Sugar', 'Acucar', '糖', 3)
  RETURNING id INTO g_sugar;

  INSERT INTO public.menu_note_preset_groups (restaurant_id, name_en, name_pt, name_zh, sort_order)
  VALUES (p_restaurant_id, 'Hot / ice', 'Quente / gelo', '冰热', 4)
  RETURNING id INTO g_temp;

  INSERT INTO public.menu_note_preset_groups (restaurant_id, name_en, name_pt, name_zh, sort_order)
  VALUES (p_restaurant_id, 'Doneness', 'Ponto da carne', '火候熟度', 5)
  RETURNING id INTO g_doneness;

  INSERT INTO public.menu_note_preset_groups (restaurant_id, name_en, name_pt, name_zh, sort_order)
  VALUES (p_restaurant_id, 'Sauce on side', 'Molho a parte', '酱汁分开', 6)
  RETURNING id INTO g_sauce;

  INSERT INTO public.menu_note_preset_groups (restaurant_id, name_en, name_pt, name_zh, sort_order)
  VALUES (p_restaurant_id, 'Pack separately', 'Embalar separado', '分开打包', 7)
  RETURNING id INTO g_pack;

  INSERT INTO public.menu_note_preset_groups (restaurant_id, name_en, name_pt, name_zh, sort_order)
  VALUES (p_restaurant_id, 'Need utensils', 'Com talheres', '需要餐具', 8)
  RETURNING id INTO g_utensils;

  INSERT INTO public.menu_note_presets (restaurant_id, group_id, name_en, name_pt, name_zh, sort_order) VALUES
    (p_restaurant_id, g_spice, 'Not spicy', 'Sem picante', '不要辣', 0),
    (p_restaurant_id, g_spice, 'Mild', 'Pouco picante', '微辣', 1),
    (p_restaurant_id, g_spice, 'Medium spicy', 'Picante medio', '中辣', 2),
    (p_restaurant_id, g_spice, 'Extra spicy', 'Muito picante', '特辣', 3),
    (p_restaurant_id, g_salt, 'Less salt', 'Pouco sal', '少盐', 0),
    (p_restaurant_id, g_oil, 'Less oil', 'Pouco oleo', '少油', 0),
    (p_restaurant_id, g_sugar, 'No sugar', 'Sem acucar', '无糖', 0),
    (p_restaurant_id, g_sugar, '30% sugar', '30% acucar', '三分糖', 1),
    (p_restaurant_id, g_sugar, '50% sugar', '50% acucar', '五分糖', 2),
    (p_restaurant_id, g_sugar, '70% sugar', '70% acucar', '七分糖', 3),
    (p_restaurant_id, g_sugar, 'Full sugar', 'Acucar normal', '全糖', 4),
    (p_restaurant_id, g_temp, 'Hot', 'Quente', '热', 0),
    (p_restaurant_id, g_temp, 'Warm', 'Morno', '温', 1),
    (p_restaurant_id, g_temp, 'Room temp', 'Temperatura ambiente', '常温', 2),
    (p_restaurant_id, g_temp, 'No ice', 'Sem gelo', '去冰', 3),
    (p_restaurant_id, g_temp, 'Less ice', 'Pouco gelo', '少冰', 4),
    (p_restaurant_id, g_temp, 'Normal ice', 'Gelo normal', '正常冰', 5),
    (p_restaurant_id, g_temp, 'Extra ice', 'Muito gelo', '多冰', 6),
    (p_restaurant_id, g_doneness, 'Rare', 'Mal passado', '三分熟', 0),
    (p_restaurant_id, g_doneness, 'Medium', 'Ao ponto', '五分熟', 1),
    (p_restaurant_id, g_doneness, 'Medium well', 'Bem ao ponto', '七分熟', 2),
    (p_restaurant_id, g_doneness, 'Well done', 'Bem passado', '全熟', 3),
    (p_restaurant_id, g_sauce, 'Sauce on side', 'Molho a parte', '酱汁分开', 0),
    (p_restaurant_id, g_pack, 'Pack separately', 'Embalar separado', '分开打包', 0),
    (p_restaurant_id, g_utensils, 'Need utensils', 'Com talheres', '需要餐具', 0);
END;
$$;


--
-- Name: seed_default_print_stations_for_restaurant(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.seed_default_print_stations_for_restaurant() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  insert into public.print_stations (restaurant_id, name_pt, name_en, name_zh, sort_order)
  select new.id, 'Cozinha', 'Kitchen', '后厨', 0
  where not exists (
    select 1 from public.print_stations ps
    where ps.restaurant_id = new.id and ps.name_pt = 'Cozinha'
  );
  insert into public.print_stations (restaurant_id, name_pt, name_en, name_zh, sort_order)
  select new.id, 'Bar', 'Bar', '吧台', 1
  where not exists (
    select 1 from public.print_stations ps
    where ps.restaurant_id = new.id and ps.name_pt = 'Bar'
  );
  return new;
end;
$$;


--
-- Name: seed_default_restaurant_tables_for_restaurant(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.seed_default_restaurant_tables_for_restaurant() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into public.restaurant_tables (restaurant_id, display_name, sort_order)
  select new.id, 'A-' || lpad(i::text, 2, '0'), i
  from generate_series(1, 10) as i
  where not exists (
    select 1 from public.restaurant_tables rt where rt.restaurant_id = new.id
  );
  return new;
end;
$$;


--
-- Name: session_person_collected_amount(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.session_person_collected_amount(p_restaurant_id uuid, p_session_id uuid, p_person_name text) RETURNS numeric
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select coalesce(sum(amount), 0)
  from public.session_collected_payments
  where restaurant_id = p_restaurant_id
    and session_id = p_session_id
    and btrim(person_name) = btrim(p_person_name);
$$;


--
-- Name: session_person_collected_by_index(uuid, uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.session_person_collected_by_index(p_restaurant_id uuid, p_session_id uuid, p_person_index integer) RETURNS numeric
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select public.session_seat_collected(
    p_restaurant_id,
    p_session_id,
    p_person_index,
    null::uuid
  );
$$;


--
-- Name: session_seat_collected(uuid, uuid, integer, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.session_seat_collected(p_restaurant_id uuid, p_session_id uuid, p_person_index integer, p_party_id uuid DEFAULT NULL::uuid) RETURNS numeric
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select coalesce(sum(amount), 0)
  from public.session_collected_payments
  where restaurant_id = p_restaurant_id
    and session_id = p_session_id
    and (
      (party_id is not null and p_party_id is not null and party_id = p_party_id)
      or (party_id is null and person_index is not distinct from p_person_index)
    );
$$;


--
-- Name: FUNCTION session_seat_collected(p_restaurant_id uuid, p_session_id uuid, p_person_index integer, p_party_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.session_seat_collected(p_restaurant_id uuid, p_session_id uuid, p_person_index integer, p_party_id uuid) IS 'Sole per-seat ledger sum: payments with party_id match p_party_id; legacy null-party_id rows match person_index.';


--
-- Name: session_total_collected(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.session_total_collected(p_restaurant_id uuid, p_session_id uuid) RETURNS numeric
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select coalesce(sum(amount), 0)
  from public.session_collected_payments
  where restaurant_id = p_restaurant_id
    and session_id = p_session_id;
$$;


--
-- Name: settle_expired_table_order_round_cooldown(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.settle_expired_table_order_round_cooldown(p_session_id uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_round public.table_order_rounds%ROWTYPE;
  v_now timestamptz := now();
BEGIN
  IF p_session_id IS NULL THEN
    RETURN 'noop';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_session_id::text));

  SELECT *
  INTO v_round
  FROM public.table_order_rounds
  WHERE session_id = p_session_id
    AND status IN ('collecting', 'pending_confirm', 'cooldown', 'finalize_failed')
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'noop';
  END IF;

  IF v_round.status = 'cooldown'
     AND v_round.cooldown_until IS NOT NULL
     AND v_round.cooldown_until > v_now THEN
    RETURN 'cooldown_active';
  END IF;

  IF v_round.status = 'cooldown'
     AND (v_round.cooldown_until IS NULL OR v_round.cooldown_until <= v_now) THEN
    UPDATE public.table_order_rounds
    SET status = 'closed', updated_at = v_now
    WHERE id = v_round.id
      AND status = 'cooldown';
    RETURN 'closed';
  END IF;

  RETURN 'noop';
END;
$$;


--
-- Name: FUNCTION settle_expired_table_order_round_cooldown(p_session_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.settle_expired_table_order_round_cooldown(p_session_id uuid) IS 'Sole expired-cooldown settle: advisory lock + close cooldown round when until <= now; returns cooldown_active|closed|noop.';


--
-- Name: staff_has_restaurant_permission(uuid, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.staff_has_restaurant_permission(p_restaurant_id uuid, p_permissions text[]) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.restaurant_staff_accounts a
    INNER JOIN public.restaurant_roles rr ON rr.id = a.role_id
    WHERE a.restaurant_id = p_restaurant_id
      AND a.user_id = (SELECT auth.uid())
      AND a.disabled_at IS NULL
      AND rr.disabled_at IS NULL
      AND a.role <> 'print_agent'
      AND EXISTS (
        SELECT 1
        FROM unnest(p_permissions) AS wanted(permission)
        WHERE rr.permissions @> to_jsonb(wanted.permission)
      )
  );
$$;


--
-- Name: FUNCTION staff_has_restaurant_permission(p_restaurant_id uuid, p_permissions text[]); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.staff_has_restaurant_permission(p_restaurant_id uuid, p_permissions text[]) IS 'True when the current auth user is an enabled non-print_agent staff account whose restaurant_roles.permissions contains any of p_permissions. Sole capability check for staff RLS that must follow configurable permissions.';


--
-- Name: sync_even_persons_to_result(jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_even_persons_to_result(p_persons jsonb, p_result jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
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


--
-- Name: table_session_allows_checkout_signals(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.table_session_allows_checkout_signals(p_session_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.table_sessions s
    where s.id = p_session_id
      and s.status in ('open', 'billing', 'closed')
  );
$$;


--
-- Name: FUNCTION table_session_allows_checkout_signals(p_session_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.table_session_allows_checkout_signals(p_session_id uuid) IS 'SECURITY DEFINER: guest Realtime/SELECT on table_checkout_signals while session is open, billing, or closed (last-pay doorbell after close). Do not use for orders/rounds.';


--
-- Name: table_session_is_open_or_billing(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.table_session_is_open_or_billing(p_session_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.table_sessions s
    WHERE s.id = p_session_id
      AND s.status IN ('open', 'billing')
  );
$$;


--
-- Name: transfer_table_session(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.transfer_table_session(p_restaurant_id uuid, p_from_table_id uuid, p_to_table_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_source_session public.table_sessions%rowtype;
  v_target_session_id uuid;
  v_target_display text;
begin
  if p_from_table_id = p_to_table_id then
    raise exception 'source and target table cannot be the same';
  end if;

  select display_name into v_target_display
  from public.get_active_restaurant_table(p_restaurant_id, p_to_table_id);
  if v_target_display is null then
    raise exception 'invalid target table';
  end if;

  if not exists (
    select 1 from public.get_active_restaurant_table(p_restaurant_id, p_from_table_id)
  ) then
    raise exception 'invalid source table';
  end if;

  select *
  into v_source_session
  from public.table_sessions
  where restaurant_id = p_restaurant_id
    and table_id = p_from_table_id
    and status in ('open', 'billing')
  order by opened_at desc
  limit 1
  for update;

  if not found then
    raise exception 'source table has no active session';
  end if;

  select id
  into v_target_session_id
  from public.table_sessions
  where restaurant_id = p_restaurant_id
    and table_id = p_to_table_id
    and status in ('open', 'billing')
  order by opened_at desc
  limit 1
  for update;

  if v_target_session_id is not null then
    raise exception 'target table already has active session';
  end if;

  update public.table_sessions
  set table_id = p_to_table_id
  where id = v_source_session.id;

  update public.orders
  set table_id = p_to_table_id,
      display_name = v_target_display,
      session_id = coalesce(session_id, v_source_session.id)
  where restaurant_id = p_restaurant_id
    and table_id = p_from_table_id
    and status in ('pending', 'cooking', 'done')
    and (session_id is null or session_id = v_source_session.id);

  update public.bill_splits
  set table_id = p_to_table_id,
      display_name = v_target_display,
      session_id = coalesce(session_id, v_source_session.id)
  where restaurant_id = p_restaurant_id
    and table_id = p_from_table_id
    and status in ('pending', 'confirmed', 'requested')
    and (session_id is null or session_id = v_source_session.id);

  return v_source_session.id;
end;
$$;


--
-- Name: transfer_table_session(uuid, uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.transfer_table_session(p_restaurant_id uuid, p_from_table_id uuid, p_to_table_id uuid, p_operator_user_id uuid DEFAULT NULL::uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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

  UPDATE public.table_order_rounds
  SET table_id = p_to_table_id,
      updated_at = now()
  WHERE session_id = v_source_session.id
    AND status IN ('collecting', 'pending_confirm', 'cooldown', 'finalize_failed');

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


--
-- Name: upsert_bill_split_request(uuid, uuid, uuid, text, uuid[], text, jsonb, jsonb, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.upsert_bill_split_request(p_restaurant_id uuid, p_session_id uuid, p_table_id uuid, p_display_name text, p_order_ids uuid[], p_split_mode text, p_persons jsonb, p_result jsonb, p_total_amount numeric) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: upsert_bill_split_request(uuid, uuid, uuid, text, uuid[], text, jsonb, jsonb, numeric, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.upsert_bill_split_request(p_restaurant_id uuid, p_session_id uuid, p_table_id uuid, p_display_name text, p_order_ids uuid[], p_split_mode text, p_persons jsonb, p_result jsonb, p_total_amount numeric, p_customer_nif text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
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
  v_wt_party_id text;
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
    -- Keep/stamp party_id (ledger attribution). Do not rebuild name/amount/paid only.
    v_wt_party_id := nullif(btrim(coalesce(
      p_result->0->>'party_id',
      p_persons->0->>'party_id',
      ''
    )), '');
    if v_wt_party_id is null then
      v_wt_party_id := gen_random_uuid()::text;
    end if;
    p_persons := jsonb_build_array(jsonb_build_object(
      'name', '__whole_table__',
      'party_id', v_wt_party_id
    ));
    p_result := jsonb_build_array(
      jsonb_build_object(
        'name', '__whole_table__',
        'amount', coalesce((p_result->0->>'amount')::numeric, p_total_amount),
        'paid', coalesce((p_result->0->>'paid')::boolean, false),
        'party_id', v_wt_party_id
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


--
-- Name: upsert_table_order_round_line(uuid, uuid, uuid, uuid, uuid, integer, text, text, integer, integer, integer, boolean, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.upsert_table_order_round_line(p_restaurant_id uuid, p_session_id uuid, p_table_id uuid, p_guest_client_id uuid, p_menu_item_id uuid, p_qty integer, p_note text, p_qty_mode text, p_live_guest_count integer, p_per_person_round_cap integer, p_session_ordered_qty integer, p_apply_meal_limit boolean, p_per_person_meal_limit integer DEFAULT NULL::integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_note text;
  v_mode text;
  v_round public.table_order_rounds%ROWTYPE;
  v_existing public.table_order_round_lines%ROWTYPE;
  v_line public.table_order_round_lines%ROWTYPE;
  v_base integer;
  v_next integer;
  v_other_round integer;
  v_meal_other integer;
  v_round_cap integer;
  v_meal_cap integer;
  v_now timestamptz := now();
  v_use_round boolean := false;
  v_settle text;
BEGIN
  IF p_qty IS NULL OR p_qty < 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_qty');
  END IF;
  IF p_live_guest_count IS NULL OR p_live_guest_count < 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'guest_count_required');
  END IF;
  IF p_per_person_round_cap IS NULL OR p_per_person_round_cap < 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_qty');
  END IF;

  v_mode := lower(coalesce(p_qty_mode, 'set'));
  IF v_mode NOT IN ('set', 'add') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_qty');
  END IF;

  v_note := left(trim(coalesce(p_note, '')), 120);

  -- Sole cooldown settle (re-entrant advisory lock with settle fn).
  v_settle := public.settle_expired_table_order_round_cooldown(p_session_id);
  IF v_settle = 'cooldown_active' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'round_cooldown_active');
  END IF;

  SELECT *
  INTO v_round
  FROM public.table_order_rounds
  WHERE session_id = p_session_id
    AND status IN ('collecting', 'pending_confirm', 'cooldown', 'finalize_failed')
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    IF v_round.status = 'finalize_failed' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'round_basket_locked');
    ELSIF v_round.status IN ('collecting', 'pending_confirm') THEN
      v_use_round := true;
    ELSE
      -- Active cooldown should already have returned above; treat residual as unusable.
      v_use_round := false;
    END IF;
  END IF;

  IF NOT v_use_round THEN
    INSERT INTO public.table_order_rounds (
      restaurant_id,
      session_id,
      table_id,
      status,
      guest_count_snapshot,
      per_person_cap,
      created_at,
      updated_at
    ) VALUES (
      p_restaurant_id,
      p_session_id,
      p_table_id,
      'collecting',
      p_live_guest_count,
      p_per_person_round_cap,
      v_now,
      v_now
    )
    RETURNING * INTO v_round;
  END IF;

  SELECT *
  INTO v_existing
  FROM public.table_order_round_lines
  WHERE round_id = v_round.id
    AND menu_item_id = p_menu_item_id
    AND guest_client_id = p_guest_client_id
    AND note = v_note
  LIMIT 1;

  v_base := CASE WHEN FOUND THEN greatest(0, floor(v_existing.qty)::int) ELSE 0 END;
  v_next := CASE WHEN v_mode = 'add' THEN v_base + p_qty ELSE p_qty END;
  IF v_next < 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_qty');
  END IF;

  SELECT coalesce(sum(greatest(0, floor(l.qty)::int)), 0)
  INTO v_other_round
  FROM public.table_order_round_lines l
  WHERE l.round_id = v_round.id
    AND NOT (
      l.menu_item_id = p_menu_item_id
      AND l.guest_client_id = p_guest_client_id
      AND l.note = v_note
    );

  v_round_cap := p_per_person_round_cap * p_live_guest_count;
  IF v_other_round + v_next > v_round_cap THEN
    RETURN jsonb_build_object('ok', false, 'error', 'round_cap_exceeded');
  END IF;

  IF p_apply_meal_limit THEN
    IF p_per_person_meal_limit IS NULL OR p_per_person_meal_limit < 1 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'over_limit_price_missing');
    END IF;
    SELECT coalesce(sum(greatest(0, floor(l.qty)::int)), 0)
    INTO v_meal_other
    FROM public.table_order_round_lines l
    WHERE l.round_id = v_round.id
      AND l.menu_item_id = p_menu_item_id
      AND NOT (
        l.guest_client_id = p_guest_client_id
        AND l.note = v_note
      );
    v_meal_other := greatest(0, coalesce(p_session_ordered_qty, 0)) + v_meal_other;
    v_meal_cap := p_per_person_meal_limit * p_live_guest_count;
    IF v_meal_other + v_next > v_meal_cap THEN
      RETURN jsonb_build_object('ok', false, 'error', 'per_person_limit_exceeded');
    END IF;
  END IF;

  IF v_existing.id IS NOT NULL THEN
    UPDATE public.table_order_round_lines
    SET qty = v_next,
        note = v_note
    WHERE id = v_existing.id
    RETURNING * INTO v_line;
  ELSE
    INSERT INTO public.table_order_round_lines (
      round_id,
      menu_item_id,
      qty,
      guest_client_id,
      note
    ) VALUES (
      v_round.id,
      p_menu_item_id,
      v_next,
      p_guest_client_id,
      v_note
    )
    RETURNING * INTO v_line;
  END IF;

  RETURN jsonb_build_object('ok', true, 'line', to_jsonb(v_line));
END;
$$;


--
-- Name: FUNCTION upsert_table_order_round_line(p_restaurant_id uuid, p_session_id uuid, p_table_id uuid, p_guest_client_id uuid, p_menu_item_id uuid, p_qty integer, p_note text, p_qty_mode text, p_live_guest_count integer, p_per_person_round_cap integer, p_session_ordered_qty integer, p_apply_meal_limit boolean, p_per_person_meal_limit integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.upsert_table_order_round_line(p_restaurant_id uuid, p_session_id uuid, p_table_id uuid, p_guest_client_id uuid, p_menu_item_id uuid, p_qty integer, p_note text, p_qty_mode text, p_live_guest_count integer, p_per_person_round_cap integer, p_session_ordered_qty integer, p_apply_meal_limit boolean, p_per_person_meal_limit integer) IS 'Sole guest round-line upsert: settle_expired cooldown + session lock + FOR UPDATE; round cap + optional meal free cap.';


--
-- Name: void_active_buffet_lines_in_items(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.void_active_buffet_lines_in_items(p_items jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
declare
  v_now text := to_char(timezone('utc', now()), 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
begin
  return coalesce((
    select jsonb_agg(
      case
        when elem->>'kind' = 'buffet_base'
             and coalesce(elem->>'item_status', 'pending') <> 'voided'
        then elem || jsonb_build_object('item_status', 'voided', 'voided_at', v_now)
        else elem
      end
    )
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) elem
  ), '[]'::jsonb);
end;
$$;


--
-- Name: void_all_line_items_for_forced_close(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.void_all_line_items_for_forced_close(p_items jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
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


--
-- Name: _uat_bak_individual_checkout; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._uat_bak_individual_checkout (
    id uuid,
    individual_checkout boolean
);


--
-- Name: abnormal_operations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.abnormal_operations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    type text NOT NULL,
    risk_level text NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    order_id uuid,
    session_id uuid,
    table_id uuid,
    table_name text,
    operator_id uuid NOT NULL,
    operator_name text NOT NULL,
    operator_role text NOT NULL,
    amount_impact numeric DEFAULT 0 NOT NULL,
    reason text NOT NULL,
    reason_detail text,
    before_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    after_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    owner_note text,
    confirmed_by uuid,
    confirmed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    source_action_id uuid,
    CONSTRAINT abnormal_operations_amount_impact_nonneg CHECK ((amount_impact >= (0)::numeric)),
    CONSTRAINT abnormal_operations_risk_level_check CHECK ((risk_level = ANY (ARRAY['LOW'::text, 'MEDIUM'::text, 'HIGH'::text]))),
    CONSTRAINT abnormal_operations_status_check CHECK ((status = ANY (ARRAY['PENDING'::text, 'CONFIRMED'::text, 'IGNORED'::text]))),
    CONSTRAINT abnormal_operations_type_check CHECK ((type = ANY (ARRAY['DISCOUNT_APPLIED'::text, 'ITEM_DELETED'::text, 'UNPAID_TABLE_CLOSED'::text])))
);


--
-- Name: analytics_daily_menu_item_consumption; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.analytics_daily_menu_item_consumption (
    restaurant_id uuid NOT NULL,
    business_date date NOT NULL,
    menu_item_id text NOT NULL,
    item_code text,
    name_pt text NOT NULL,
    name_en text,
    name_zh text,
    consumed_quantity numeric(12,3) DEFAULT 0 NOT NULL,
    amount numeric(12,2) DEFAULT 0 NOT NULL,
    sealed_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT analytics_daily_menu_item_consumption_amount_nonnegative CHECK ((amount >= (0)::numeric)),
    CONSTRAINT analytics_daily_menu_item_consumption_qty_nonnegative CHECK ((consumed_quantity >= (0)::numeric))
);


--
-- Name: TABLE analytics_daily_menu_item_consumption; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.analytics_daily_menu_item_consumption IS 'Sealed Lisbon-day full menu-item consumption by qty; sole source for value-analytics dish ranking windows.';


--
-- Name: analytics_daily_menu_item_stats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.analytics_daily_menu_item_stats (
    restaurant_id uuid NOT NULL,
    business_date date NOT NULL,
    rank smallint NOT NULL,
    item_id text NOT NULL,
    name_pt text NOT NULL,
    name_en text,
    name_zh text,
    consumed_quantity numeric(12,3) DEFAULT 0 NOT NULL,
    amount numeric(12,2) DEFAULT 0 NOT NULL,
    sealed_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT analytics_daily_menu_item_stats_amount_nonnegative CHECK ((amount >= (0)::numeric)),
    CONSTRAINT analytics_daily_menu_item_stats_qty_nonnegative CHECK ((consumed_quantity >= (0)::numeric)),
    CONSTRAINT analytics_daily_menu_item_stats_rank_range CHECK (((rank >= 1) AND (rank <= 10)))
);


--
-- Name: TABLE analytics_daily_menu_item_stats; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.analytics_daily_menu_item_stats IS 'Sealed Lisbon-day top menu items by consumed quantity (max 10 ranks); written with analytics_daily_restaurant_stats.';


--
-- Name: analytics_daily_restaurant_stats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.analytics_daily_restaurant_stats (
    restaurant_id uuid NOT NULL,
    business_date date NOT NULL,
    revenue numeric(12,2) DEFAULT 0 NOT NULL,
    adult_count integer DEFAULT 0 NOT NULL,
    child_count integer DEFAULT 0 NOT NULL,
    customer_count integer DEFAULT 0 NOT NULL,
    qualifying_session_count integer DEFAULT 0 NOT NULL,
    sealed_at timestamp with time zone DEFAULT now() NOT NULL,
    computed_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT analytics_daily_restaurant_stats_counts_nonnegative CHECK (((adult_count >= 0) AND (child_count >= 0) AND (customer_count >= 0) AND (qualifying_session_count >= 0)))
);


--
-- Name: TABLE analytics_daily_restaurant_stats; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.analytics_daily_restaurant_stats IS 'Sealed Lisbon-day value-analytics metrics; today is computed live and not stored here until sealed.';


--
-- Name: bill_split_ticket_calls; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bill_split_ticket_calls (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    session_id uuid NOT NULL,
    bill_split_id uuid NOT NULL,
    ticket_key text NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    client_id uuid,
    state text NOT NULL,
    called_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT bill_split_ticket_calls_state_check CHECK ((state = ANY (ARRAY['called'::text, 'unlocked'::text])))
);


--
-- Name: TABLE bill_split_ticket_calls; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.bill_split_ticket_calls IS 'Per-ticket call/unlock state for individual-checkout sessions. client_id = guest phone (never exposed to guests).';


--
-- Name: bill_splits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bill_splits (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    restaurant_id uuid NOT NULL,
    order_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    split_mode text NOT NULL,
    persons jsonb DEFAULT '[]'::jsonb NOT NULL,
    result jsonb DEFAULT '[]'::jsonb NOT NULL,
    total_amount numeric(10,2) DEFAULT 0 NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    session_id uuid,
    table_id uuid NOT NULL,
    display_name text NOT NULL,
    customer_nif text,
    discount_rate numeric DEFAULT 0 NOT NULL,
    discount_reason text,
    discount_reason_detail text,
    revision integer DEFAULT 0 NOT NULL,
    staff_checkout_requested_at timestamp with time zone,
    CONSTRAINT bill_splits_discount_rate_range CHECK (((discount_rate >= (0)::numeric) AND (discount_rate <= (100)::numeric))),
    CONSTRAINT bill_splits_split_mode_check CHECK ((split_mode = ANY (ARRAY['whole_table'::text, 'even'::text, 'by_item'::text, 'custom'::text]))),
    CONSTRAINT bill_splits_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'requested'::text, 'paid'::text, 'cancelled'::text])))
);

ALTER TABLE ONLY public.bill_splits REPLICA IDENTITY FULL;


--
-- Name: COLUMN bill_splits.customer_nif; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bill_splits.customer_nif IS 'Optional Portuguese NIF (9 digits) supplied by the guest at checkout request.';


--
-- Name: COLUMN bill_splits.discount_rate; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bill_splits.discount_rate IS 'Checkout discount percent (0–100) applied to the whole bill before split collection.';


--
-- Name: COLUMN bill_splits.discount_reason; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bill_splits.discount_reason IS 'Abnormal-operation reason code when discount_rate > 0.';


--
-- Name: COLUMN bill_splits.discount_reason_detail; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bill_splits.discount_reason_detail IS 'Optional detail when discount_reason requires it.';


--
-- Name: COLUMN bill_splits.staff_checkout_requested_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bill_splits.staff_checkout_requested_at IS 'Staff took over checkout (floor 呼叫结账 or by-item collect held open). While set, individual_refresh_split_status keeps status=requested. Cleared by resume_table_session_ordering.';


--
-- Name: bill_sync_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bill_sync_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    request_id uuid NOT NULL,
    source_system text DEFAULT 'farvoo'::text NOT NULL,
    source_sale_id uuid NOT NULL,
    table_display_name text NOT NULL,
    scope_type text NOT NULL,
    payload jsonb NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    error_code text,
    error_message text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    document_id text,
    invoice_no text,
    CONSTRAINT bill_sync_jobs_scope_type_check CHECK ((scope_type = ANY (ARRAY['whole_table'::text, 'split'::text]))),
    CONSTRAINT bill_sync_jobs_source_system_check CHECK ((source_system = 'farvoo'::text)),
    CONSTRAINT bill_sync_jobs_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'succeeded'::text, 'failed'::text])))
);


--
-- Name: TABLE bill_sync_jobs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.bill_sync_jobs IS 'Hang-queue for Farvoo→fiscal bill-sync drafts; Agent pulls via agentjwt + Realtime on this table.';


--
-- Name: COLUMN bill_sync_jobs.document_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bill_sync_jobs.document_id IS 'Agent fiscal invoices.id after auto_issue success; sole cloud key for reprint.';


--
-- Name: COLUMN bill_sync_jobs.invoice_no; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bill_sync_jobs.invoice_no IS 'Agent invoice_no copy after auto_issue success (display / toast).';


--
-- Name: buffet_calendar_overrides; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.buffet_calendar_overrides (
    restaurant_id uuid NOT NULL,
    on_date date NOT NULL,
    kind text NOT NULL,
    CONSTRAINT buffet_calendar_overrides_kind_check CHECK ((kind = ANY (ARRAY['holiday'::text, 'special'::text])))
);

ALTER TABLE ONLY public.buffet_calendar_overrides REPLICA IDENTITY FULL;


--
-- Name: buffet_price_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.buffet_price_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    buffet_id uuid NOT NULL,
    time_slot_id uuid NOT NULL,
    calendar_kind text NOT NULL,
    valid_from date NOT NULL,
    valid_to date NOT NULL,
    adult_price numeric(10,2) NOT NULL,
    child_price numeric(10,2) NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT buffet_price_rules_calendar_kind_check CHECK ((calendar_kind = ANY (ARRAY['weekday'::text, 'weekend'::text, 'holiday'::text, 'special'::text]))),
    CONSTRAINT buffet_price_rules_valid_range CHECK ((valid_to >= valid_from))
);

ALTER TABLE ONLY public.buffet_price_rules REPLICA IDENTITY FULL;


--
-- Name: buffet_time_slots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.buffet_time_slots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    name text NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    weekdays integer[] DEFAULT ARRAY[0, 1, 2, 3, 4, 5, 6] NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.buffet_time_slots REPLICA IDENTITY FULL;


--
-- Name: buffets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.buffets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    vat_rate numeric(5,2) DEFAULT 13 NOT NULL,
    CONSTRAINT buffets_vat_rate_range CHECK (((vat_rate >= (0)::numeric) AND (vat_rate <= (100)::numeric)))
);

ALTER TABLE ONLY public.buffets REPLICA IDENTITY FULL;


--
-- Name: COLUMN buffets.vat_rate; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.buffets.vat_rate IS 'VAT / IVA rate in percent for buffet headcount lines (e.g. 13). Required; default 13.';


--
-- Name: cash_drawer_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cash_drawer_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    session_id uuid,
    collected_payment_id uuid,
    status text DEFAULT 'pending'::text NOT NULL,
    error_code text,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    CONSTRAINT cash_drawer_jobs_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'succeeded'::text, 'failed'::text, 'expired'::text])))
);

ALTER TABLE ONLY public.cash_drawer_jobs REPLICA IDENTITY FULL;


--
-- Name: TABLE cash_drawer_jobs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.cash_drawer_jobs IS 'Short-TTL hang-queue: CASH collect → Agent kick via CashDrawerKickBytes; never blocks payment.';


--
-- Name: dish_feedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dish_feedback (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    session_id uuid NOT NULL,
    order_id uuid NOT NULL,
    menu_item_id uuid NOT NULL,
    vote text NOT NULL,
    reasons text[] DEFAULT '{}'::text[] NOT NULL,
    comment text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT dish_feedback_vote_check CHECK ((vote = ANY (ARRAY['up'::text, 'down'::text])))
);


--
-- Name: feedback_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feedback_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    session_id uuid NOT NULL,
    source text DEFAULT 'bill_success'::text NOT NULL,
    shown_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    skipped_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: fiscal_signing_installations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fiscal_signing_installations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    device_id uuid NOT NULL,
    device_public_key text NOT NULL,
    signing_key_version integer DEFAULT 1 NOT NULL,
    product_public_key_pem text,
    wrapped_private_key text,
    status text NOT NULL,
    activated_at timestamp with time zone,
    revoked_at timestamp with time zone,
    activated_by uuid,
    revoked_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT fiscal_signing_installations_status_check CHECK ((status = ANY (ARRAY['registered'::text, 'active'::text, 'revoked'::text])))
);


--
-- Name: fiscal_terminal_pairings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fiscal_terminal_pairings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    code text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    consumed_at timestamp with time zone,
    revoked_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: fiscal_terminals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fiscal_terminals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    label text,
    active boolean DEFAULT true NOT NULL,
    ops_terminal_ref uuid DEFAULT gen_random_uuid() NOT NULL,
    pairing_id uuid,
    registered_at timestamp with time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp with time zone,
    revoked_at timestamp with time zone
);


--
-- Name: kitchen_screen_stations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kitchen_screen_stations (
    screen_id uuid NOT NULL,
    print_station_id uuid NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);


--
-- Name: kitchen_screens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kitchen_screens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    name text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: menu_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.menu_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    parent_id uuid,
    name_pt text NOT NULL,
    name_en text,
    name_zh text,
    sort_order integer DEFAULT 0 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    print_station_id uuid,
    item_code character varying(10)
);


--
-- Name: COLUMN menu_categories.item_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.menu_categories.item_code IS 'Optional category code (max 10), printed on tickets before dish code.';


--
-- Name: menu_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.menu_items (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    restaurant_id uuid NOT NULL,
    name_pt text NOT NULL,
    name_en text,
    name_zh text,
    description_pt text,
    description_en text,
    price numeric(10,2) NOT NULL,
    category text NOT NULL,
    emoji text DEFAULT '🍽️'::text NOT NULL,
    available boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    image_url text,
    note_preset_group_ids text[] DEFAULT '{}'::text[] NOT NULL,
    category_en text,
    category_zh text,
    category_id uuid,
    print_station_id uuid,
    item_code character varying(10) NOT NULL,
    vat_rate numeric(5,2) DEFAULT 23 NOT NULL,
    per_person_qty_limit integer,
    over_limit_unit_price numeric,
    allergen_codes text[] DEFAULT '{}'::text[] NOT NULL,
    is_vegetarian boolean DEFAULT false NOT NULL,
    description_zh text,
    flavor_codes text[] DEFAULT '{}'::text[] NOT NULL,
    station_print_pt boolean DEFAULT true NOT NULL,
    station_print_en boolean DEFAULT false NOT NULL,
    station_print_zh boolean DEFAULT false NOT NULL,
    time_slot_id uuid,
    CONSTRAINT menu_items_item_code_max_len_10 CHECK ((char_length(btrim((item_code)::text)) <= 10)),
    CONSTRAINT menu_items_item_code_not_blank CHECK ((btrim((item_code)::text) <> ''::text)),
    CONSTRAINT menu_items_limit_requires_overage_price CHECK ((((per_person_qty_limit IS NULL) AND (over_limit_unit_price IS NULL)) OR ((per_person_qty_limit IS NOT NULL) AND (over_limit_unit_price IS NOT NULL)))),
    CONSTRAINT menu_items_over_limit_unit_price_check CHECK (((over_limit_unit_price IS NULL) OR (over_limit_unit_price >= (0)::numeric))),
    CONSTRAINT menu_items_per_person_qty_limit_check CHECK (((per_person_qty_limit IS NULL) OR (per_person_qty_limit >= 1))),
    CONSTRAINT menu_items_vat_rate_range CHECK (((vat_rate >= (0)::numeric) AND (vat_rate <= (100)::numeric)))
);


--
-- Name: COLUMN menu_items.note_preset_group_ids; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.menu_items.note_preset_group_ids IS 'Enabled note-preset group ids (menu_note_preset_groups.id); guest sees all active presets in these groups.';


--
-- Name: COLUMN menu_items.item_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.menu_items.item_code IS 'Optional dish code (max 10), printed on tickets after category path.';


--
-- Name: COLUMN menu_items.vat_rate; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.menu_items.vat_rate IS 'VAT / IVA rate in percent (e.g. 23 for 23%). Required per dish.';


--
-- Name: COLUMN menu_items.per_person_qty_limit; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.menu_items.per_person_qty_limit IS 'When restaurant is sushi mode: max included portions per guest (adult+child). NULL = unlimited.';


--
-- Name: COLUMN menu_items.over_limit_unit_price; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.menu_items.over_limit_unit_price IS 'Unit price for portions beyond free allowance; required when per_person_qty_limit is set.';


--
-- Name: COLUMN menu_items.allergen_codes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.menu_items.allergen_codes IS 'EU allergen codes this dish is known to contain (egg, milk, soy, gluten, peanut, sulphites, fish, molluscs, mustard, tree_nuts, sesame, celery, lupin, crustaceans). Empty = unmarked, not allergen-free.';


--
-- Name: COLUMN menu_items.is_vegetarian; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.menu_items.is_vegetarian IS 'Owner-marked vegetarian dish. false = not marked vegetarian (default).';


--
-- Name: COLUMN menu_items.description_zh; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.menu_items.description_zh IS 'Optional Chinese dish description; guest UI prefers this when lang=zh.';


--
-- Name: COLUMN menu_items.flavor_codes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.menu_items.flavor_codes IS 'Display-only flavor hint codes (spice_mild|medium|extra, numb_*, sour, sweet, sweet_sour, light, heavy, umami, aroma_*). Empty = none shown. Gated by menu_flavor_hints_enabled.';


--
-- Name: COLUMN menu_items.time_slot_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.menu_items.time_slot_id IS 'Menu time slot (buffet_time_slots). Null = all day. Guest menu + append use the slot nearest to the table session opened_at (lib/menu-time-slot).';


--
-- Name: menu_note_preset_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.menu_note_preset_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    name_en text NOT NULL,
    name_pt text NOT NULL,
    name_zh text DEFAULT ''::text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT menu_note_preset_groups_name_en_nonempty CHECK ((length(btrim(name_en)) > 0)),
    CONSTRAINT menu_note_preset_groups_name_pt_nonempty CHECK ((length(btrim(name_pt)) > 0))
);


--
-- Name: TABLE menu_note_preset_groups; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.menu_note_preset_groups IS 'Per-restaurant note preset groups (CRUD). Empty group may be deleted; group with presets may not.';


--
-- Name: menu_note_presets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.menu_note_presets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    group_id uuid NOT NULL,
    name_en text NOT NULL,
    name_pt text NOT NULL,
    name_zh text DEFAULT ''::text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT menu_note_presets_name_en_nonempty CHECK ((length(btrim(name_en)) > 0)),
    CONSTRAINT menu_note_presets_name_pt_nonempty CHECK ((length(btrim(name_pt)) > 0))
);


--
-- Name: TABLE menu_note_presets; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.menu_note_presets IS 'Per-restaurant note presets. menu_items.note_preset_group_ids references group ids; presets belong via group_id.';


--
-- Name: menu_recommended_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.menu_recommended_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    menu_item_id uuid NOT NULL,
    sort_order integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE menu_recommended_items; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.menu_recommended_items IS 'Ordered recommended dishes for the customer menu strip. Empty = hide the recommended section.';


--
-- Name: operation_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.operation_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    action_type text NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    operator_id uuid NOT NULL,
    operator_name text NOT NULL,
    operator_role text NOT NULL,
    before_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    after_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    reason text,
    reason_detail text,
    ip_address text,
    device_info text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: order_append_idempotency; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_append_idempotency (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    session_id uuid NOT NULL,
    client_request_id uuid NOT NULL,
    status text NOT NULL,
    order_id uuid,
    batch_id text,
    had_done_before boolean,
    is_first_order boolean,
    line_count integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT order_append_idempotency_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'completed'::text])))
);


--
-- Name: TABLE order_append_idempotency; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.order_append_idempotency IS 'Append intent dedupe: UNIQUE(session_id, client_request_id); completed rows store replay fields (token re-signed on read).';


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    restaurant_id uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    items jsonb DEFAULT '[]'::jsonb NOT NULL,
    total_amount numeric(10,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    session_id uuid,
    table_id uuid NOT NULL,
    display_name text NOT NULL,
    CONSTRAINT orders_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'cooking'::text, 'done'::text])))
);

ALTER TABLE ONLY public.orders REPLICA IDENTITY FULL;


--
-- Name: platform_admin_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_admin_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role text NOT NULL,
    display_name text NOT NULL,
    disabled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT platform_admin_accounts_role_check CHECK ((role = ANY (ARRAY['support'::text, 'admin'::text])))
);


--
-- Name: platform_admin_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_admin_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_user_id uuid,
    action text NOT NULL,
    target_type text NOT NULL,
    target_id text NOT NULL,
    restaurant_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: platform_pro_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_pro_settings (
    id text DEFAULT 'default'::text NOT NULL,
    premium_keys jsonb DEFAULT '["value_analytics", "abnormal_ops", "operation_logs"]'::jsonb NOT NULL,
    wechat_url text,
    whatsapp_url text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT platform_pro_settings_id_check CHECK ((id = 'default'::text))
);


--
-- Name: TABLE platform_pro_settings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.platform_pro_settings IS 'Singleton: which premium keys require Pro + upgrade contact links for tenant upsell page.';


--
-- Name: print_agent_devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.print_agent_devices (
    id uuid NOT NULL,
    restaurant_id uuid NOT NULL,
    pairing_id uuid,
    label text,
    paired_at timestamp with time zone DEFAULT now() NOT NULL,
    valid_until timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    last_seen timestamp with time zone,
    routing_snapshot jsonb,
    agent_version text,
    mapped_station_count integer,
    last_print_at timestamp with time zone,
    last_print_status text,
    schedule_open boolean,
    notification_mode text,
    CONSTRAINT print_agent_devices_notification_mode_check CHECK (((notification_mode IS NULL) OR (notification_mode = ANY (ARRAY['realtime'::text, 'polling'::text]))))
);


--
-- Name: COLUMN print_agent_devices.routing_snapshot; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.print_agent_devices.routing_snapshot IS 'Receipt printer options synced from agent configure/setup: { receipt_printers: [{ id, label, role }], updated_at }';


--
-- Name: COLUMN print_agent_devices.agent_version; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.print_agent_devices.agent_version IS 'MesaPrintAgent build version from heartbeat.';


--
-- Name: COLUMN print_agent_devices.mapped_station_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.print_agent_devices.mapped_station_count IS 'Non-empty station_printers mappings at last heartbeat.';


--
-- Name: COLUMN print_agent_devices.last_print_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.print_agent_devices.last_print_at IS 'Timestamp of last print attempt reported by agent.';


--
-- Name: COLUMN print_agent_devices.last_print_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.print_agent_devices.last_print_status IS 'done | failed from last print attempt.';


--
-- Name: COLUMN print_agent_devices.schedule_open; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.print_agent_devices.schedule_open IS 'Whether agent was inside business hours at last heartbeat.';


--
-- Name: COLUMN print_agent_devices.notification_mode; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.print_agent_devices.notification_mode IS 'Last heartbeat notifier mode: realtime (WebSocket) or polling (HTTP fallback).';


--
-- Name: print_agent_pairings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.print_agent_pairings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    code text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    consumed_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    CONSTRAINT print_agent_pairings_code_check CHECK ((code ~ '^[0-9]{6}$'::text))
);


--
-- Name: COLUMN print_agent_pairings.revoked_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.print_agent_pairings.revoked_at IS 'Set when the restaurant owner voids an unused code before expiry; frees a pending slot.';


--
-- Name: print_agent_support_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.print_agent_support_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    device_id uuid NOT NULL,
    restaurant_id uuid NOT NULL,
    actor_user_id uuid NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    consumed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: print_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.print_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    type text NOT NULL,
    payload jsonb NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    claimed_by text,
    attempts integer DEFAULT 0 NOT NULL,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    table_display text GENERATED ALWAYS AS (NULLIF(btrim((payload ->> 'display_name'::text)), ''::text)) STORED,
    table_id uuid GENERATED ALWAYS AS (
CASE
    WHEN ((payload ? 'table_id'::text) AND ((payload ->> 'table_id'::text) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'::text)) THEN ((payload ->> 'table_id'::text))::uuid
    ELSE NULL::uuid
END) STORED,
    CONSTRAINT print_jobs_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'done'::text, 'failed'::text]))),
    CONSTRAINT print_jobs_type_check CHECK ((type = ANY (ARRAY['order_receipt'::text, 'station_ticket'::text, 'pre_bill'::text])))
);

ALTER TABLE ONLY public.print_jobs REPLICA IDENTITY FULL;


--
-- Name: print_stations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.print_stations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    name_pt text NOT NULL,
    name_en text,
    name_zh text,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    kitchen_enabled boolean DEFAULT false NOT NULL
);


--
-- Name: COLUMN print_stations.kitchen_enabled; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.print_stations.kitchen_enabled IS 'When true: station uses kitchen screen workflow (no auto station_ticket on order; prep prints).';


--
-- Name: restaurant_installations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.restaurant_installations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    install_code_hash text NOT NULL,
    checkin_secret_hash text,
    status text DEFAULT 'pending'::text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    consumed_at timestamp with time zone,
    claimed_at timestamp with time zone,
    revoked_at timestamp with time zone,
    last_checkin_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT restaurant_installations_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'claimed'::text, 'revoked'::text])))
);


--
-- Name: TABLE restaurant_installations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.restaurant_installations IS 'On-prem install codes + check-in identity; one pending and one claimed per restaurant.';


--
-- Name: restaurant_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.restaurant_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    name text NOT NULL,
    preset_key text,
    permissions jsonb DEFAULT '[]'::jsonb NOT NULL,
    disabled_at timestamp with time zone,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT restaurant_roles_name_not_blank CHECK ((length(TRIM(BOTH FROM name)) > 0)),
    CONSTRAINT restaurant_roles_preset_key_check CHECK (((preset_key IS NULL) OR (preset_key = ANY (ARRAY['kitchen'::text, 'waiter'::text, 'cashier'::text, 'frontdesk'::text, 'owner'::text]))))
);


--
-- Name: restaurant_staff_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.restaurant_staff_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text NOT NULL,
    display_name text NOT NULL,
    login_name text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    disabled_at timestamp with time zone,
    role_id uuid,
    CONSTRAINT restaurant_staff_accounts_role_check CHECK ((role = ANY (ARRAY['kitchen'::text, 'waiter'::text, 'cashier'::text, 'frontdesk'::text, 'print_agent'::text, 'custom'::text, 'owner'::text])))
);


--
-- Name: restaurant_table_group_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.restaurant_table_group_members (
    group_id uuid NOT NULL,
    table_id uuid NOT NULL,
    restaurant_id uuid NOT NULL
);


--
-- Name: restaurant_table_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.restaurant_table_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    name text NOT NULL,
    remarks text,
    sort_order integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT restaurant_table_groups_name_len CHECK (((char_length(btrim(name)) >= 1) AND (char_length(btrim(name)) <= 32)))
);


--
-- Name: restaurants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.restaurants (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    owner_id uuid,
    logo_url text,
    address text,
    phone text,
    plan text DEFAULT 'basic'::text NOT NULL,
    kitchen_password text DEFAULT '1234'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    waiter_password text DEFAULT '5678'::text NOT NULL,
    geo_latitude double precision,
    geo_longitude double precision,
    print_locale text DEFAULT 'pt'::text NOT NULL,
    print_agent_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    kitchen_password_version integer DEFAULT 1 NOT NULL,
    waiter_password_version integer DEFAULT 1 NOT NULL,
    order_radius_meters integer DEFAULT 1000 NOT NULL,
    buffet_friday_weekend_from time without time zone,
    feature_flags jsonb DEFAULT '{}'::jsonb NOT NULL,
    suspended_at timestamp with time zone,
    suspension_reason text,
    country_code character(2) DEFAULT 'PT'::bpchar NOT NULL,
    order_cooldown_seconds integer DEFAULT 5 NOT NULL,
    buffet_service_mode text DEFAULT 'classic'::text NOT NULL,
    guest_ordering_notice jsonb DEFAULT jsonb_build_object('enabled', false, 'title', jsonb_build_object('pt', '', 'en', '', 'zh', ''), 'body', jsonb_build_object('pt', '', 'en', '', 'zh', ''), 'updated_at', NULL::unknown) NOT NULL,
    permissions_version integer DEFAULT 0 NOT NULL,
    deployment_mode text DEFAULT 'cloud'::text NOT NULL,
    license_valid_until timestamp with time zone,
    owner_email text,
    license_checked_at timestamp with time zone,
    license_lease_until timestamp with time zone,
    license_lease_token text,
    license_offline_grace_days integer DEFAULT 7 NOT NULL,
    menu_catalog_version integer DEFAULT 0 NOT NULL,
    operation_log_retention_days integer DEFAULT 7 NOT NULL,
    pro_valid_until timestamp with time zone,
    sushi_round_ordering_enabled boolean DEFAULT true NOT NULL,
    sushi_per_person_per_round_cap integer DEFAULT 8 NOT NULL,
    sushi_round_confirm_timeout_seconds integer DEFAULT 25 NOT NULL,
    sushi_round_cooldown_seconds integer DEFAULT 120 NOT NULL,
    sushi_round_rules_notice jsonb,
    fiscal_profile text,
    max_fiscal_terminals integer DEFAULT 1 NOT NULL,
    sushi_menu_vegetarian_filter_enabled boolean DEFAULT false NOT NULL,
    sushi_menu_allergen_filter_enabled boolean DEFAULT false NOT NULL,
    cover_url text,
    business_hours jsonb DEFAULT '{}'::jsonb NOT NULL,
    storefront_intro jsonb DEFAULT jsonb_build_object('pt', '', 'en', '', 'zh', '') NOT NULL,
    CONSTRAINT restaurants_buffet_service_mode_check CHECK ((buffet_service_mode = ANY (ARRAY['classic'::text, 'sushi'::text]))),
    CONSTRAINT restaurants_cloud_owner_required CHECK (((deployment_mode <> 'cloud'::text) OR (owner_id IS NOT NULL))),
    CONSTRAINT restaurants_country_code_check CHECK ((country_code ~ '^[A-Z]{2}$'::text)),
    CONSTRAINT restaurants_deployment_mode_check CHECK ((deployment_mode = ANY (ARRAY['cloud'::text, 'on_prem'::text]))),
    CONSTRAINT restaurants_fiscal_profile_check CHECK (((fiscal_profile IS NULL) OR (fiscal_profile = ANY (ARRAY['restaurant'::text, 'retail'::text])))),
    CONSTRAINT restaurants_license_offline_grace_days_range CHECK (((license_offline_grace_days >= 1) AND (license_offline_grace_days <= 365))),
    CONSTRAINT restaurants_max_fiscal_terminals_check CHECK ((max_fiscal_terminals >= 1)),
    CONSTRAINT restaurants_operation_log_retention_days_check CHECK (((operation_log_retention_days >= 7) AND (operation_log_retention_days <= 90))),
    CONSTRAINT restaurants_order_cooldown_seconds_check CHECK (((order_cooldown_seconds >= 5) AND (order_cooldown_seconds <= 1800))),
    CONSTRAINT restaurants_order_radius_meters_check CHECK (((order_radius_meters >= 10) AND (order_radius_meters <= 10000))),
    CONSTRAINT restaurants_plan_check CHECK ((plan = ANY (ARRAY['basic'::text, 'pro'::text]))),
    CONSTRAINT restaurants_print_locale_check CHECK ((print_locale = ANY (ARRAY['zh'::text, 'en'::text, 'pt'::text]))),
    CONSTRAINT restaurants_sushi_per_person_per_round_cap_range CHECK (((sushi_per_person_per_round_cap >= 1) AND (sushi_per_person_per_round_cap <= 20))),
    CONSTRAINT restaurants_sushi_round_confirm_timeout_range CHECK (((sushi_round_confirm_timeout_seconds >= 15) AND (sushi_round_confirm_timeout_seconds <= 45))),
    CONSTRAINT restaurants_sushi_round_cooldown_range CHECK (((sushi_round_cooldown_seconds >= 30) AND (sushi_round_cooldown_seconds <= 600)))
);


--
-- Name: COLUMN restaurants.kitchen_password; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.restaurants.kitchen_password IS 'bcrypt hash of 4-digit kitchen PIN';


--
-- Name: COLUMN restaurants.waiter_password; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.restaurants.waiter_password IS 'bcrypt hash of 4-digit waiter PIN';


--
-- Name: COLUMN restaurants.print_agent_config; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.restaurants.print_agent_config IS 'Print agent schedule/poll JSON: { schedule, poll }. Printers stay on the local agent config.';


--
-- Name: COLUMN restaurants.kitchen_password_version; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.restaurants.kitchen_password_version IS 'Bumped when kitchen PIN changes; must match staff session JWT pwd_ver for role kitchen';


--
-- Name: COLUMN restaurants.waiter_password_version; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.restaurants.waiter_password_version IS 'Bumped when waiter PIN changes; must match staff session JWT pwd_ver for role waiter';


--
-- Name: COLUMN restaurants.buffet_friday_weekend_from; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.restaurants.buffet_friday_weekend_from IS 'Lisbon local time: on Fridays at or after this time, buffet pricing uses calendar_kind=weekend. NULL = disabled.';


--
-- Name: COLUMN restaurants.feature_flags; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.restaurants.feature_flags IS 'Owner-controlled feature switches, e.g. {"kitchen_board": true}. Missing keys use app defaults.';


--
-- Name: COLUMN restaurants.buffet_service_mode; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.restaurants.buffet_service_mode IS 'classic = unlimited menu items after open; sushi = optional per-person qty limits with overage pricing';


--
-- Name: COLUMN restaurants.guest_ordering_notice; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.restaurants.guest_ordering_notice IS 'Customer menu notice: { enabled, title{pt,en,zh}, body{pt,en,zh}, updated_at }. Plain text only.';


--
-- Name: COLUMN restaurants.deployment_mode; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.restaurants.deployment_mode IS 'cloud = SaaS tenant row; on_prem = platform control-plane registry (business authority is local after claim)';


--
-- Name: COLUMN restaurants.license_valid_until; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.restaurants.license_valid_until IS 'Platform license end; null = no expiry. Materialize into suspended_at when past.';


--
-- Name: COLUMN restaurants.license_checked_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.restaurants.license_checked_at IS 'Last successful platform check-in server_time (local lease clock). cloud unused.';


--
-- Name: COLUMN restaurants.license_lease_until; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.restaurants.license_lease_until IS 'Offline grace end from last signed lease. cloud unused.';


--
-- Name: COLUMN restaurants.license_lease_token; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.restaurants.license_lease_token IS 'HMAC-signed lease JWT from platform check-in. cloud unused.';


--
-- Name: COLUMN restaurants.license_offline_grace_days; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.restaurants.license_offline_grace_days IS 'On-prem: days without platform check-in before lease expires (minted into lease_until). Cloud unused.';


--
-- Name: COLUMN restaurants.menu_catalog_version; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.restaurants.menu_catalog_version IS 'Monotonic counter bumped when customer-facing menu catalog changes (items/categories/availability). Clients compare before re-fetching the full catalog.';


--
-- Name: COLUMN restaurants.pro_valid_until; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.restaurants.pro_valid_until IS 'Pro membership expiry (UTC). Null with plan=pro means no pro expiry. Effective pro also requires license_valid_until when set.';


--
-- Name: COLUMN restaurants.sushi_round_ordering_enabled; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.restaurants.sushi_round_ordering_enabled IS 'When buffet_service_mode=sushi: enable table order rounds. Classic ignores.';


--
-- Name: COLUMN restaurants.fiscal_profile; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.restaurants.fiscal_profile IS 'Ops-only: restaurant|retail; required before fiscal signing activate';


--
-- Name: COLUMN restaurants.max_fiscal_terminals; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.restaurants.max_fiscal_terminals IS 'Ops-only: max LAN fiscal terminal slots';


--
-- Name: COLUMN restaurants.sushi_menu_vegetarian_filter_enabled; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.restaurants.sushi_menu_vegetarian_filter_enabled IS 'When true and buffet_service_mode=sushi, guest sushi menu shows vegetarian lamp filter. Default false.';


--
-- Name: COLUMN restaurants.sushi_menu_allergen_filter_enabled; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.restaurants.sushi_menu_allergen_filter_enabled IS 'When true and buffet_service_mode=sushi, guest sushi menu shows allergen-avoid filter. Default false.';


--
-- Name: COLUMN restaurants.cover_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.restaurants.cover_url IS 'Guest menu storefront cover image public URL (optional).';


--
-- Name: COLUMN restaurants.business_hours; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.restaurants.business_hours IS 'Guest-facing weekly hours: { timezone?: string, week?: { "1"|"2"|…|"7": [{open,close},…] } }. Europe/Lisbon default. Not print-agent schedule.';


--
-- Name: COLUMN restaurants.storefront_intro; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.restaurants.storefront_intro IS 'Guest storefront intro: { pt, en, zh }. Plain text; empty langs omit.';


--
-- Name: restaurants_public; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.restaurants_public WITH (security_invoker='false') AS
 SELECT id,
    name,
    slug,
    logo_url,
    cover_url,
    address,
    phone,
    plan,
    geo_latitude,
    geo_longitude,
    print_locale,
    created_at,
    order_radius_meters,
    buffet_service_mode,
    guest_ordering_notice,
    business_hours,
    storefront_intro
   FROM public.restaurants;


--
-- Name: VIEW restaurants_public; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.restaurants_public IS 'Public restaurant fields for ordering surfaces (no passwords); includes storefront profile.';


--
-- Name: session_collected_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_collected_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    session_id uuid NOT NULL,
    person_name text NOT NULL,
    amount numeric NOT NULL,
    bill_split_id uuid,
    created_by_user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    person_index integer,
    payment_method text,
    payment_lines jsonb,
    client_request_id uuid,
    party_id uuid,
    CONSTRAINT session_collected_payments_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT session_collected_payments_payment_method_check CHECK (((payment_method IS NULL) OR (payment_method = ANY (ARRAY['CASH'::text, 'MULTIBANCO'::text, 'MIXED'::text]))))
);


--
-- Name: TABLE session_collected_payments; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.session_collected_payments IS 'Append-only ledger of per-person collections within a table session; survives checkout resume and re-checkout.';


--
-- Name: COLUMN session_collected_payments.person_index; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.session_collected_payments.person_index IS 'Index into bill_splits.result[] at collection time; authoritative for reconciliation.';


--
-- Name: COLUMN session_collected_payments.payment_method; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.session_collected_payments.payment_method IS 'CASH | MULTIBANCO | MIXED (sole collect/invoice codes).';


--
-- Name: COLUMN session_collected_payments.payment_lines; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.session_collected_payments.payment_lines IS 'Sole multi-tender split [{method:CASH|MULTIBANCO, amount:"x.xx"}, …]; required for MIXED.';


--
-- Name: COLUMN session_collected_payments.party_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.session_collected_payments.party_id IS 'Stable seat/ticket id (same as bill_splits.result[].party_id). Authoritative for attribution; person_index is legacy-only when this is null.';


--
-- Name: table_checkout_signals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.table_checkout_signals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    session_id uuid NOT NULL,
    kind text NOT NULL,
    reason text NOT NULL,
    ticket_key text,
    name text,
    items jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT table_checkout_signals_kind_check CHECK ((kind = ANY (ARRAY['call'::text, 'silent'::text]))),
    CONSTRAINT table_checkout_signals_reason_check CHECK ((reason = ANY (ARRAY['call'::text, 'unlock'::text, 'update'::text])))
);


--
-- Name: table_order_round_clients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.table_order_round_clients (
    session_id uuid NOT NULL,
    guest_client_id uuid NOT NULL,
    restaurant_id uuid NOT NULL,
    registered_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: table_order_round_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.table_order_round_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    round_id uuid NOT NULL,
    menu_item_id uuid NOT NULL,
    qty integer NOT NULL,
    guest_client_id uuid NOT NULL,
    added_at timestamp with time zone DEFAULT now() NOT NULL,
    note text DEFAULT ''::text NOT NULL,
    CONSTRAINT table_order_round_lines_note_len CHECK ((char_length(note) <= 120)),
    CONSTRAINT table_order_round_lines_qty_check CHECK ((qty >= 1))
);

ALTER TABLE ONLY public.table_order_round_lines REPLICA IDENTITY FULL;


--
-- Name: COLUMN table_order_round_lines.note; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.table_order_round_lines.note IS 'Guest cart note on this client+item line; empty string when none.';


--
-- Name: table_order_rounds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.table_order_rounds (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    session_id uuid NOT NULL,
    table_id uuid NOT NULL,
    status text NOT NULL,
    guest_count_snapshot integer DEFAULT 0 NOT NULL,
    per_person_cap integer DEFAULT 8 NOT NULL,
    submit_request_id uuid,
    submit_requested_at timestamp with time zone,
    submit_deadline_at timestamp with time zone,
    cooldown_until timestamp with time zone,
    append_client_request_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT table_order_rounds_status_check CHECK ((status = ANY (ARRAY['collecting'::text, 'pending_confirm'::text, 'cooldown'::text, 'closed'::text, 'finalize_failed'::text])))
);

ALTER TABLE ONLY public.table_order_rounds REPLICA IDENTITY FULL;


--
-- Name: table_party_group_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.table_party_group_members (
    party_id uuid NOT NULL,
    table_id uuid NOT NULL,
    restaurant_id uuid NOT NULL
);


--
-- Name: table_party_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.table_party_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    name text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT table_party_groups_name_len CHECK (((char_length(btrim(name)) >= 1) AND (char_length(btrim(name)) <= 32)))
);


--
-- Name: table_session_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.table_session_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    session_id uuid NOT NULL,
    event_type text NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    operator_user_id uuid,
    from_table_id uuid NOT NULL,
    to_table_id uuid NOT NULL,
    from_display_name text NOT NULL,
    to_display_name text NOT NULL,
    CONSTRAINT table_session_events_event_type_check CHECK ((event_type = 'transfer'::text))
);


--
-- Name: TABLE table_session_events; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.table_session_events IS 'Append-only mid-session audit (transfer). Order history reads via service role.';


--
-- Name: table_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.table_sessions (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    restaurant_id uuid NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    opened_at timestamp with time zone DEFAULT now() NOT NULL,
    closed_at timestamp with time zone,
    merge_into_session_id uuid,
    closed_reason text,
    table_id uuid NOT NULL,
    closed_by_user_id uuid,
    opened_by_user_id uuid,
    settled_payable_amount numeric,
    opened_by_name text,
    CONSTRAINT table_sessions_status_check CHECK ((status = ANY (ARRAY['open'::text, 'billing'::text, 'closed'::text])))
);

ALTER TABLE ONLY public.table_sessions REPLICA IDENTITY FULL;


--
-- Name: COLUMN table_sessions.closed_by_user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.table_sessions.closed_by_user_id IS 'Auth user who closed the session: checkout/settled/operational close, or merge operator when closed_reason=merged. Null for auto_nightly or legacy.';


--
-- Name: COLUMN table_sessions.opened_by_user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.table_sessions.opened_by_user_id IS 'Supabase auth user who opened the session (waiter buffet / waiter order). Null for legacy sessions or guest-only paths.';


--
-- Name: COLUMN table_sessions.settled_payable_amount; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.table_sessions.settled_payable_amount IS 'Billable session payable written at settled checkout close (sumBillableSessionTotal). Null for operational closes and legacy rows.';


--
-- Name: COLUMN table_sessions.opened_by_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.table_sessions.opened_by_name IS 'Opener label stamped at session open (same ladder as resolveStaffOperatorDisplayName / Auth username). Board and history read this; do not re-resolve from opened_by_user_id for display.';


--
-- Name: abnormal_operations abnormal_operations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.abnormal_operations
    ADD CONSTRAINT abnormal_operations_pkey PRIMARY KEY (id);


--
-- Name: analytics_daily_menu_item_consumption analytics_daily_menu_item_consumption_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_daily_menu_item_consumption
    ADD CONSTRAINT analytics_daily_menu_item_consumption_pkey PRIMARY KEY (restaurant_id, business_date, menu_item_id);


--
-- Name: analytics_daily_menu_item_stats analytics_daily_menu_item_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_daily_menu_item_stats
    ADD CONSTRAINT analytics_daily_menu_item_stats_pkey PRIMARY KEY (restaurant_id, business_date, rank);


--
-- Name: analytics_daily_restaurant_stats analytics_daily_restaurant_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_daily_restaurant_stats
    ADD CONSTRAINT analytics_daily_restaurant_stats_pkey PRIMARY KEY (restaurant_id, business_date);


--
-- Name: bill_split_ticket_calls bill_split_ticket_calls_bill_split_id_ticket_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bill_split_ticket_calls
    ADD CONSTRAINT bill_split_ticket_calls_bill_split_id_ticket_key_key UNIQUE (bill_split_id, ticket_key);


--
-- Name: bill_split_ticket_calls bill_split_ticket_calls_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bill_split_ticket_calls
    ADD CONSTRAINT bill_split_ticket_calls_pkey PRIMARY KEY (id);


--
-- Name: bill_splits bill_splits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bill_splits
    ADD CONSTRAINT bill_splits_pkey PRIMARY KEY (id);


--
-- Name: bill_sync_jobs bill_sync_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bill_sync_jobs
    ADD CONSTRAINT bill_sync_jobs_pkey PRIMARY KEY (id);


--
-- Name: bill_sync_jobs bill_sync_jobs_restaurant_request_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bill_sync_jobs
    ADD CONSTRAINT bill_sync_jobs_restaurant_request_unique UNIQUE (restaurant_id, request_id);


--
-- Name: buffet_calendar_overrides buffet_calendar_overrides_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.buffet_calendar_overrides
    ADD CONSTRAINT buffet_calendar_overrides_pkey PRIMARY KEY (restaurant_id, on_date);


--
-- Name: buffet_price_rules buffet_price_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.buffet_price_rules
    ADD CONSTRAINT buffet_price_rules_pkey PRIMARY KEY (id);


--
-- Name: buffet_time_slots buffet_time_slots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.buffet_time_slots
    ADD CONSTRAINT buffet_time_slots_pkey PRIMARY KEY (id);


--
-- Name: buffet_time_slots buffet_time_slots_restaurant_id_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.buffet_time_slots
    ADD CONSTRAINT buffet_time_slots_restaurant_id_id_key UNIQUE (restaurant_id, id);


--
-- Name: buffets buffets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.buffets
    ADD CONSTRAINT buffets_pkey PRIMARY KEY (id);


--
-- Name: cash_drawer_jobs cash_drawer_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_drawer_jobs
    ADD CONSTRAINT cash_drawer_jobs_pkey PRIMARY KEY (id);


--
-- Name: dish_feedback dish_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dish_feedback
    ADD CONSTRAINT dish_feedback_pkey PRIMARY KEY (id);


--
-- Name: feedback_sessions feedback_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedback_sessions
    ADD CONSTRAINT feedback_sessions_pkey PRIMARY KEY (id);


--
-- Name: fiscal_signing_installations fiscal_signing_installations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fiscal_signing_installations
    ADD CONSTRAINT fiscal_signing_installations_pkey PRIMARY KEY (id);


--
-- Name: fiscal_terminal_pairings fiscal_terminal_pairings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fiscal_terminal_pairings
    ADD CONSTRAINT fiscal_terminal_pairings_pkey PRIMARY KEY (id);


--
-- Name: fiscal_terminals fiscal_terminals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fiscal_terminals
    ADD CONSTRAINT fiscal_terminals_pkey PRIMARY KEY (id);


--
-- Name: kitchen_screen_stations kitchen_screen_stations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kitchen_screen_stations
    ADD CONSTRAINT kitchen_screen_stations_pkey PRIMARY KEY (screen_id, print_station_id);


--
-- Name: kitchen_screens kitchen_screens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kitchen_screens
    ADD CONSTRAINT kitchen_screens_pkey PRIMARY KEY (id);


--
-- Name: menu_categories menu_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_categories
    ADD CONSTRAINT menu_categories_pkey PRIMARY KEY (id);


--
-- Name: menu_items menu_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT menu_items_pkey PRIMARY KEY (id);


--
-- Name: menu_note_preset_groups menu_note_preset_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_note_preset_groups
    ADD CONSTRAINT menu_note_preset_groups_pkey PRIMARY KEY (id);


--
-- Name: menu_note_presets menu_note_presets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_note_presets
    ADD CONSTRAINT menu_note_presets_pkey PRIMARY KEY (id);


--
-- Name: menu_recommended_items menu_recommended_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_recommended_items
    ADD CONSTRAINT menu_recommended_items_pkey PRIMARY KEY (id);


--
-- Name: operation_logs operation_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operation_logs
    ADD CONSTRAINT operation_logs_pkey PRIMARY KEY (id);


--
-- Name: order_append_idempotency order_append_idempotency_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_append_idempotency
    ADD CONSTRAINT order_append_idempotency_pkey PRIMARY KEY (id);


--
-- Name: order_append_idempotency order_append_idempotency_session_id_client_request_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_append_idempotency
    ADD CONSTRAINT order_append_idempotency_session_id_client_request_id_key UNIQUE (session_id, client_request_id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: platform_admin_accounts platform_admin_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_admin_accounts
    ADD CONSTRAINT platform_admin_accounts_pkey PRIMARY KEY (id);


--
-- Name: platform_admin_accounts platform_admin_accounts_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_admin_accounts
    ADD CONSTRAINT platform_admin_accounts_user_id_key UNIQUE (user_id);


--
-- Name: platform_admin_audit_log platform_admin_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_admin_audit_log
    ADD CONSTRAINT platform_admin_audit_log_pkey PRIMARY KEY (id);


--
-- Name: platform_pro_settings platform_pro_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_pro_settings
    ADD CONSTRAINT platform_pro_settings_pkey PRIMARY KEY (id);


--
-- Name: print_agent_devices print_agent_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.print_agent_devices
    ADD CONSTRAINT print_agent_devices_pkey PRIMARY KEY (id);


--
-- Name: print_agent_pairings print_agent_pairings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.print_agent_pairings
    ADD CONSTRAINT print_agent_pairings_pkey PRIMARY KEY (id);


--
-- Name: print_agent_support_tokens print_agent_support_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.print_agent_support_tokens
    ADD CONSTRAINT print_agent_support_tokens_pkey PRIMARY KEY (id);


--
-- Name: print_jobs print_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.print_jobs
    ADD CONSTRAINT print_jobs_pkey PRIMARY KEY (id);


--
-- Name: print_stations print_stations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.print_stations
    ADD CONSTRAINT print_stations_pkey PRIMARY KEY (id);


--
-- Name: restaurant_installations restaurant_installations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_installations
    ADD CONSTRAINT restaurant_installations_pkey PRIMARY KEY (id);


--
-- Name: restaurant_roles restaurant_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_roles
    ADD CONSTRAINT restaurant_roles_pkey PRIMARY KEY (id);


--
-- Name: restaurant_staff_accounts restaurant_staff_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_staff_accounts
    ADD CONSTRAINT restaurant_staff_accounts_pkey PRIMARY KEY (id);


--
-- Name: restaurant_staff_accounts restaurant_staff_accounts_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_staff_accounts
    ADD CONSTRAINT restaurant_staff_accounts_user_id_key UNIQUE (user_id);


--
-- Name: restaurant_table_group_members restaurant_table_group_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_table_group_members
    ADD CONSTRAINT restaurant_table_group_members_pkey PRIMARY KEY (group_id, table_id);


--
-- Name: restaurant_table_groups restaurant_table_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_table_groups
    ADD CONSTRAINT restaurant_table_groups_pkey PRIMARY KEY (id);


--
-- Name: restaurant_tables restaurant_tables_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_tables
    ADD CONSTRAINT restaurant_tables_pkey PRIMARY KEY (id);


--
-- Name: restaurants restaurants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurants
    ADD CONSTRAINT restaurants_pkey PRIMARY KEY (id);


--
-- Name: restaurants restaurants_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurants
    ADD CONSTRAINT restaurants_slug_key UNIQUE (slug);


--
-- Name: session_collected_payments session_collected_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_collected_payments
    ADD CONSTRAINT session_collected_payments_pkey PRIMARY KEY (id);


--
-- Name: table_checkout_signals table_checkout_signals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_checkout_signals
    ADD CONSTRAINT table_checkout_signals_pkey PRIMARY KEY (id);


--
-- Name: table_order_round_clients table_order_round_clients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_order_round_clients
    ADD CONSTRAINT table_order_round_clients_pkey PRIMARY KEY (session_id, guest_client_id);


--
-- Name: table_order_round_lines table_order_round_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_order_round_lines
    ADD CONSTRAINT table_order_round_lines_pkey PRIMARY KEY (id);


--
-- Name: table_order_round_lines table_order_round_lines_round_id_menu_item_id_guest_client__key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_order_round_lines
    ADD CONSTRAINT table_order_round_lines_round_id_menu_item_id_guest_client__key UNIQUE (round_id, menu_item_id, guest_client_id);


--
-- Name: table_order_rounds table_order_rounds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_order_rounds
    ADD CONSTRAINT table_order_rounds_pkey PRIMARY KEY (id);


--
-- Name: table_party_group_members table_party_group_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_party_group_members
    ADD CONSTRAINT table_party_group_members_pkey PRIMARY KEY (party_id, table_id);


--
-- Name: table_party_groups table_party_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_party_groups
    ADD CONSTRAINT table_party_groups_pkey PRIMARY KEY (id);


--
-- Name: table_session_events table_session_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_session_events
    ADD CONSTRAINT table_session_events_pkey PRIMARY KEY (id);


--
-- Name: table_sessions table_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_sessions
    ADD CONSTRAINT table_sessions_pkey PRIMARY KEY (id);


--
-- Name: bill_split_ticket_calls_session_client_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bill_split_ticket_calls_session_client_idx ON public.bill_split_ticket_calls USING btree (session_id, client_id);


--
-- Name: bill_sync_jobs_restaurant_source_sale_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bill_sync_jobs_restaurant_source_sale_idx ON public.bill_sync_jobs USING btree (restaurant_id, source_sale_id, created_at DESC);


--
-- Name: bill_sync_jobs_restaurant_status_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bill_sync_jobs_restaurant_status_created_idx ON public.bill_sync_jobs USING btree (restaurant_id, status, created_at);


--
-- Name: bill_sync_jobs_sale_issued_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bill_sync_jobs_sale_issued_idx ON public.bill_sync_jobs USING btree (restaurant_id, source_sale_id, created_at DESC) WHERE ((document_id IS NOT NULL) AND (status = 'succeeded'::text));


--
-- Name: cash_drawer_jobs_restaurant_status_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cash_drawer_jobs_restaurant_status_created_idx ON public.cash_drawer_jobs USING btree (restaurant_id, status, created_at);


--
-- Name: fiscal_signing_installations_one_active_per_restaurant; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX fiscal_signing_installations_one_active_per_restaurant ON public.fiscal_signing_installations USING btree (restaurant_id) WHERE (status = 'active'::text);


--
-- Name: fiscal_signing_installations_one_open_per_device; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX fiscal_signing_installations_one_open_per_device ON public.fiscal_signing_installations USING btree (restaurant_id, device_id) WHERE (status = ANY (ARRAY['registered'::text, 'active'::text]));


--
-- Name: fiscal_signing_installations_restaurant_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fiscal_signing_installations_restaurant_status ON public.fiscal_signing_installations USING btree (restaurant_id, status);


--
-- Name: fiscal_terminal_pairings_open_code_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX fiscal_terminal_pairings_open_code_idx ON public.fiscal_terminal_pairings USING btree (restaurant_id, code) WHERE ((consumed_at IS NULL) AND (revoked_at IS NULL));


--
-- Name: fiscal_terminals_restaurant_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fiscal_terminals_restaurant_active_idx ON public.fiscal_terminals USING btree (restaurant_id) WHERE ((active = true) AND (revoked_at IS NULL));


--
-- Name: idx_abnormal_operations_restaurant_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_abnormal_operations_restaurant_created ON public.abnormal_operations USING btree (restaurant_id, created_at DESC);


--
-- Name: idx_abnormal_operations_restaurant_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_abnormal_operations_restaurant_status ON public.abnormal_operations USING btree (restaurant_id, status);


--
-- Name: idx_abnormal_operations_restaurant_unpaid_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_abnormal_operations_restaurant_unpaid_session ON public.abnormal_operations USING btree (restaurant_id, session_id) WHERE ((type = 'UNPAID_TABLE_CLOSED'::text) AND (session_id IS NOT NULL));


--
-- Name: idx_analytics_daily_menu_item_consumption_restaurant_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_daily_menu_item_consumption_restaurant_date ON public.analytics_daily_menu_item_consumption USING btree (restaurant_id, business_date DESC);


--
-- Name: idx_analytics_daily_menu_item_stats_restaurant_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_daily_menu_item_stats_restaurant_date ON public.analytics_daily_menu_item_stats USING btree (restaurant_id, business_date DESC);


--
-- Name: idx_analytics_daily_restaurant_stats_restaurant_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_daily_restaurant_stats_restaurant_date ON public.analytics_daily_restaurant_stats USING btree (restaurant_id, business_date DESC);


--
-- Name: idx_bill_splits_one_active_per_session; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_bill_splits_one_active_per_session ON public.bill_splits USING btree (session_id) WHERE ((session_id IS NOT NULL) AND (status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'requested'::text])));


--
-- Name: idx_bill_splits_restaurant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bill_splits_restaurant ON public.bill_splits USING btree (restaurant_id);


--
-- Name: idx_bill_splits_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bill_splits_session ON public.bill_splits USING btree (session_id);


--
-- Name: idx_buffet_price_rules_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_buffet_price_rules_lookup ON public.buffet_price_rules USING btree (restaurant_id, buffet_id, time_slot_id, calendar_kind) WHERE (is_active = true);


--
-- Name: idx_buffet_time_slots_restaurant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_buffet_time_slots_restaurant ON public.buffet_time_slots USING btree (restaurant_id);


--
-- Name: idx_buffets_restaurant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_buffets_restaurant ON public.buffets USING btree (restaurant_id);


--
-- Name: idx_dish_feedback_restaurant_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dish_feedback_restaurant_created ON public.dish_feedback USING btree (restaurant_id, created_at DESC);


--
-- Name: idx_dish_feedback_vote; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dish_feedback_vote ON public.dish_feedback USING btree (restaurant_id, vote);


--
-- Name: idx_feedback_sessions_restaurant_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feedback_sessions_restaurant_created ON public.feedback_sessions USING btree (restaurant_id, created_at DESC);


--
-- Name: idx_kitchen_screen_stations_station; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kitchen_screen_stations_station ON public.kitchen_screen_stations USING btree (print_station_id);


--
-- Name: idx_kitchen_screens_restaurant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kitchen_screens_restaurant ON public.kitchen_screens USING btree (restaurant_id, sort_order, created_at);


--
-- Name: idx_menu_categories_code_per_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_menu_categories_code_per_parent ON public.menu_categories USING btree (restaurant_id, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(btrim((item_code)::text))) WHERE ((item_code IS NOT NULL) AND (btrim((item_code)::text) <> ''::text));


--
-- Name: idx_menu_categories_print_station; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_menu_categories_print_station ON public.menu_categories USING btree (print_station_id) WHERE (print_station_id IS NOT NULL);


--
-- Name: idx_menu_categories_restaurant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_menu_categories_restaurant ON public.menu_categories USING btree (restaurant_id, parent_id, sort_order);


--
-- Name: idx_menu_items_allergen_codes; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_menu_items_allergen_codes ON public.menu_items USING gin (allergen_codes);


--
-- Name: idx_menu_items_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_menu_items_category ON public.menu_items USING btree (restaurant_id, category);


--
-- Name: idx_menu_items_category_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_menu_items_category_id ON public.menu_items USING btree (restaurant_id, category_id);


--
-- Name: idx_menu_items_category_sort_order; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_menu_items_category_sort_order ON public.menu_items USING btree (restaurant_id, category_id, sort_order) WHERE (category_id IS NOT NULL);


--
-- Name: idx_menu_items_code_per_restaurant; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_menu_items_code_per_restaurant ON public.menu_items USING btree (restaurant_id, lower(btrim((item_code)::text))) WHERE ((item_code IS NOT NULL) AND (btrim((item_code)::text) <> ''::text));


--
-- Name: idx_menu_items_flavor_codes; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_menu_items_flavor_codes ON public.menu_items USING gin (flavor_codes);


--
-- Name: idx_menu_items_note_preset_group_ids; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_menu_items_note_preset_group_ids ON public.menu_items USING gin (note_preset_group_ids);


--
-- Name: idx_menu_items_print_station; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_menu_items_print_station ON public.menu_items USING btree (restaurant_id, print_station_id) WHERE (print_station_id IS NOT NULL);


--
-- Name: idx_menu_items_restaurant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_menu_items_restaurant ON public.menu_items USING btree (restaurant_id);


--
-- Name: idx_menu_items_time_slot; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_menu_items_time_slot ON public.menu_items USING btree (time_slot_id) WHERE (time_slot_id IS NOT NULL);


--
-- Name: idx_menu_items_uncategorized_sort_order; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_menu_items_uncategorized_sort_order ON public.menu_items USING btree (restaurant_id, sort_order) WHERE (category_id IS NULL);


--
-- Name: idx_menu_note_preset_groups_restaurant_sort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_menu_note_preset_groups_restaurant_sort ON public.menu_note_preset_groups USING btree (restaurant_id, sort_order, created_at);


--
-- Name: idx_menu_note_presets_restaurant_group_sort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_menu_note_presets_restaurant_group_sort ON public.menu_note_presets USING btree (restaurant_id, group_id, sort_order, created_at);


--
-- Name: idx_menu_recommended_items_restaurant_sort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_menu_recommended_items_restaurant_sort ON public.menu_recommended_items USING btree (restaurant_id, sort_order, created_at);


--
-- Name: idx_operation_logs_restaurant_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_operation_logs_restaurant_created ON public.operation_logs USING btree (restaurant_id, created_at DESC);


--
-- Name: idx_order_append_idempotency_restaurant_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_append_idempotency_restaurant_created ON public.order_append_idempotency USING btree (restaurant_id, created_at DESC);


--
-- Name: idx_orders_restaurant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_restaurant ON public.orders USING btree (restaurant_id);


--
-- Name: idx_orders_restaurant_status_updated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_restaurant_status_updated_at ON public.orders USING btree (restaurant_id, status, updated_at DESC);


--
-- Name: idx_orders_restaurant_table_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_restaurant_table_id ON public.orders USING btree (restaurant_id, table_id);


--
-- Name: idx_orders_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_session ON public.orders USING btree (session_id);


--
-- Name: idx_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_status ON public.orders USING btree (restaurant_id, status);


--
-- Name: idx_platform_admin_audit_log_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_platform_admin_audit_log_created ON public.platform_admin_audit_log USING btree (created_at DESC);


--
-- Name: idx_platform_admin_audit_log_restaurant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_platform_admin_audit_log_restaurant ON public.platform_admin_audit_log USING btree (restaurant_id) WHERE (restaurant_id IS NOT NULL);


--
-- Name: idx_print_agent_devices_restaurant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_print_agent_devices_restaurant ON public.print_agent_devices USING btree (restaurant_id);


--
-- Name: idx_print_agent_pairings_claim_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_print_agent_pairings_claim_lookup ON public.print_agent_pairings USING btree (code) WHERE ((consumed_at IS NULL) AND (revoked_at IS NULL));


--
-- Name: idx_print_agent_pairings_restaurant_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_print_agent_pairings_restaurant_expires ON public.print_agent_pairings USING btree (restaurant_id, expires_at DESC);


--
-- Name: idx_print_agent_pairings_restaurant_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_print_agent_pairings_restaurant_pending ON public.print_agent_pairings USING btree (restaurant_id, expires_at DESC) WHERE ((consumed_at IS NULL) AND (revoked_at IS NULL));


--
-- Name: idx_print_agent_support_tokens_device_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_print_agent_support_tokens_device_created ON public.print_agent_support_tokens USING btree (device_id, created_at DESC);


--
-- Name: idx_print_jobs_restaurant_status_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_print_jobs_restaurant_status_created ON public.print_jobs USING btree (restaurant_id, status, created_at DESC);


--
-- Name: idx_print_jobs_restaurant_table_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_print_jobs_restaurant_table_id ON public.print_jobs USING btree (restaurant_id, table_id, created_at DESC) WHERE (table_id IS NOT NULL);


--
-- Name: idx_print_stations_restaurant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_print_stations_restaurant ON public.print_stations USING btree (restaurant_id, sort_order, created_at);


--
-- Name: idx_restaurant_installations_code_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_restaurant_installations_code_hash ON public.restaurant_installations USING btree (install_code_hash);


--
-- Name: idx_restaurant_installations_one_claimed; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_restaurant_installations_one_claimed ON public.restaurant_installations USING btree (restaurant_id) WHERE (status = 'claimed'::text);


--
-- Name: idx_restaurant_installations_one_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_restaurant_installations_one_pending ON public.restaurant_installations USING btree (restaurant_id) WHERE (status = 'pending'::text);


--
-- Name: idx_restaurant_installations_restaurant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_restaurant_installations_restaurant ON public.restaurant_installations USING btree (restaurant_id, created_at DESC);


--
-- Name: idx_restaurant_table_group_members_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_restaurant_table_group_members_group ON public.restaurant_table_group_members USING btree (group_id);


--
-- Name: idx_restaurant_table_groups_restaurant_sort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_restaurant_table_groups_restaurant_sort ON public.restaurant_table_groups USING btree (restaurant_id, sort_order, created_at);


--
-- Name: idx_restaurant_tables_restaurant_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_restaurant_tables_restaurant_active ON public.restaurant_tables USING btree (restaurant_id, sort_order) WHERE (deleted_at IS NULL);


--
-- Name: idx_restaurants_deployment_mode; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_restaurants_deployment_mode ON public.restaurants USING btree (deployment_mode);


--
-- Name: idx_restaurants_license_valid_until; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_restaurants_license_valid_until ON public.restaurants USING btree (license_valid_until) WHERE (license_valid_until IS NOT NULL);


--
-- Name: idx_restaurants_suspended_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_restaurants_suspended_at ON public.restaurants USING btree (suspended_at) WHERE (suspended_at IS NOT NULL);


--
-- Name: idx_session_collected_payments_restaurant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_collected_payments_restaurant ON public.session_collected_payments USING btree (restaurant_id, created_at DESC);


--
-- Name: idx_session_collected_payments_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_collected_payments_session ON public.session_collected_payments USING btree (session_id, created_at);


--
-- Name: idx_table_order_round_clients_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_table_order_round_clients_session ON public.table_order_round_clients USING btree (session_id, registered_at);


--
-- Name: idx_table_order_round_lines_round; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_table_order_round_lines_round ON public.table_order_round_lines USING btree (round_id);


--
-- Name: idx_table_order_rounds_restaurant_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_table_order_rounds_restaurant_session ON public.table_order_rounds USING btree (restaurant_id, session_id);


--
-- Name: idx_table_party_group_members_party; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_table_party_group_members_party ON public.table_party_group_members USING btree (party_id);


--
-- Name: idx_table_party_groups_restaurant_sort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_table_party_groups_restaurant_sort ON public.table_party_groups USING btree (restaurant_id, sort_order, created_at);


--
-- Name: idx_table_session_events_restaurant_from_table; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_table_session_events_restaurant_from_table ON public.table_session_events USING btree (restaurant_id, from_table_id);


--
-- Name: idx_table_session_events_session_occurred; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_table_session_events_session_occurred ON public.table_session_events USING btree (session_id, occurred_at);


--
-- Name: idx_table_sessions_merge_into; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_table_sessions_merge_into ON public.table_sessions USING btree (merge_into_session_id);


--
-- Name: idx_table_sessions_restaurant_closed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_table_sessions_restaurant_closed_at ON public.table_sessions USING btree (restaurant_id, closed_at DESC) WHERE (status = 'closed'::text);


--
-- Name: idx_table_sessions_restaurant_table_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_table_sessions_restaurant_table_id ON public.table_sessions USING btree (restaurant_id, table_id);


--
-- Name: idx_table_sessions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_table_sessions_status ON public.table_sessions USING btree (restaurant_id, status);


--
-- Name: menu_recommended_items_restaurant_item_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX menu_recommended_items_restaurant_item_unique ON public.menu_recommended_items USING btree (restaurant_id, menu_item_id);


--
-- Name: menu_recommended_items_restaurant_sort_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX menu_recommended_items_restaurant_sort_unique ON public.menu_recommended_items USING btree (restaurant_id, sort_order);


--
-- Name: restaurant_roles_one_preset_per_restaurant; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX restaurant_roles_one_preset_per_restaurant ON public.restaurant_roles USING btree (restaurant_id, preset_key) WHERE (preset_key IS NOT NULL);


--
-- Name: restaurant_roles_restaurant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX restaurant_roles_restaurant_id_idx ON public.restaurant_roles USING btree (restaurant_id);


--
-- Name: restaurant_roles_unique_name_per_restaurant; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX restaurant_roles_unique_name_per_restaurant ON public.restaurant_roles USING btree (restaurant_id, lower(TRIM(BOTH FROM name)));


--
-- Name: restaurant_staff_accounts_login_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX restaurant_staff_accounts_login_name_key ON public.restaurant_staff_accounts USING btree (login_name);


--
-- Name: restaurant_staff_accounts_one_print_agent_per_restaurant; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX restaurant_staff_accounts_one_print_agent_per_restaurant ON public.restaurant_staff_accounts USING btree (restaurant_id) WHERE (role = 'print_agent'::text);


--
-- Name: restaurant_staff_accounts_restaurant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX restaurant_staff_accounts_restaurant_id_idx ON public.restaurant_staff_accounts USING btree (restaurant_id);


--
-- Name: restaurant_staff_accounts_role_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX restaurant_staff_accounts_role_id_idx ON public.restaurant_staff_accounts USING btree (role_id);


--
-- Name: restaurant_staff_accounts_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX restaurant_staff_accounts_user_id_idx ON public.restaurant_staff_accounts USING btree (user_id);


--
-- Name: restaurant_table_group_members_restaurant_table_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX restaurant_table_group_members_restaurant_table_unique ON public.restaurant_table_group_members USING btree (restaurant_id, table_id);


--
-- Name: restaurant_table_groups_restaurant_name_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX restaurant_table_groups_restaurant_name_unique ON public.restaurant_table_groups USING btree (restaurant_id, name);


--
-- Name: restaurant_tables_active_display_name_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX restaurant_tables_active_display_name_unique ON public.restaurant_tables USING btree (restaurant_id, display_name) WHERE (deleted_at IS NULL);


--
-- Name: session_collected_payments_client_request_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX session_collected_payments_client_request_uidx ON public.session_collected_payments USING btree (restaurant_id, client_request_id) WHERE (client_request_id IS NOT NULL);


--
-- Name: session_collected_payments_session_party_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX session_collected_payments_session_party_idx ON public.session_collected_payments USING btree (session_id, party_id) WHERE (party_id IS NOT NULL);


--
-- Name: table_checkout_signals_session_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX table_checkout_signals_session_idx ON public.table_checkout_signals USING btree (session_id, created_at DESC);


--
-- Name: table_party_group_members_restaurant_table_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX table_party_group_members_restaurant_table_unique ON public.table_party_group_members USING btree (restaurant_id, table_id);


--
-- Name: table_party_groups_restaurant_name_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX table_party_groups_restaurant_name_unique ON public.table_party_groups USING btree (restaurant_id, lower(btrim(name)));


--
-- Name: uniq_active_table_session; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uniq_active_table_session ON public.table_sessions USING btree (restaurant_id, table_id) WHERE (status = ANY (ARRAY['open'::text, 'billing'::text]));


--
-- Name: uniq_dish_feedback_session_item; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uniq_dish_feedback_session_item ON public.dish_feedback USING btree (session_id, menu_item_id);


--
-- Name: uniq_feedback_session; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uniq_feedback_session ON public.feedback_sessions USING btree (session_id);


--
-- Name: uniq_table_order_round_lines_round_item_guest_note; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uniq_table_order_round_lines_round_item_guest_note ON public.table_order_round_lines USING btree (round_id, menu_item_id, guest_client_id, note);


--
-- Name: INDEX uniq_table_order_round_lines_round_item_guest_note; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.uniq_table_order_round_lines_round_item_guest_note IS 'One round line per (item, guest, note); different notes stay separate rows.';


--
-- Name: uniq_table_order_rounds_active_session; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uniq_table_order_rounds_active_session ON public.table_order_rounds USING btree (session_id) WHERE (status = ANY (ARRAY['collecting'::text, 'pending_confirm'::text, 'cooldown'::text, 'finalize_failed'::text]));


--
-- Name: abnormal_operations abnormal_operations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER abnormal_operations_updated_at BEFORE UPDATE ON public.abnormal_operations FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: bill_splits bill_splits_bump_revision; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER bill_splits_bump_revision BEFORE UPDATE ON public.bill_splits FOR EACH ROW EXECUTE FUNCTION public.bill_splits_bump_revision();


--
-- Name: bill_splits bill_splits_individual_sync; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER bill_splits_individual_sync AFTER INSERT OR UPDATE ON public.bill_splits FOR EACH ROW EXECUTE FUNCTION public.bill_splits_individual_sync();


--
-- Name: buffets buffets_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER buffets_updated_at BEFORE UPDATE ON public.buffets FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: dish_feedback dish_feedback_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dish_feedback_updated_at BEFORE UPDATE ON public.dish_feedback FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: menu_categories menu_categories_print_station_restaurant; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER menu_categories_print_station_restaurant BEFORE INSERT OR UPDATE OF print_station_id, restaurant_id ON public.menu_categories FOR EACH ROW EXECUTE FUNCTION public.enforce_print_station_same_restaurant();


--
-- Name: menu_items menu_items_print_station_restaurant; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER menu_items_print_station_restaurant BEFORE INSERT OR UPDATE OF print_station_id, restaurant_id ON public.menu_items FOR EACH ROW EXECUTE FUNCTION public.enforce_print_station_same_restaurant();


--
-- Name: menu_note_presets menu_note_presets_same_restaurant; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER menu_note_presets_same_restaurant BEFORE INSERT OR UPDATE OF restaurant_id, group_id ON public.menu_note_presets FOR EACH ROW EXECUTE FUNCTION public.enforce_menu_note_preset_same_restaurant();


--
-- Name: menu_recommended_items menu_recommended_items_same_restaurant; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER menu_recommended_items_same_restaurant BEFORE INSERT OR UPDATE OF restaurant_id, menu_item_id ON public.menu_recommended_items FOR EACH ROW EXECUTE FUNCTION public.enforce_menu_recommended_item_same_restaurant();


--
-- Name: orders orders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: print_jobs print_jobs_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER print_jobs_set_updated_at BEFORE UPDATE ON public.print_jobs FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: restaurant_table_group_members restaurant_table_group_members_same_restaurant; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER restaurant_table_group_members_same_restaurant BEFORE INSERT OR UPDATE OF group_id, table_id, restaurant_id ON public.restaurant_table_group_members FOR EACH ROW EXECUTE FUNCTION public.enforce_table_group_member_same_restaurant();


--
-- Name: restaurant_tables restaurant_tables_soft_delete_purge_group_member; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER restaurant_tables_soft_delete_purge_group_member AFTER UPDATE OF deleted_at ON public.restaurant_tables FOR EACH ROW EXECUTE FUNCTION public.purge_table_group_member_on_soft_delete();


--
-- Name: restaurant_tables restaurant_tables_soft_delete_purge_party_member; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER restaurant_tables_soft_delete_purge_party_member AFTER UPDATE OF deleted_at ON public.restaurant_tables FOR EACH ROW EXECUTE FUNCTION public.purge_table_party_member_on_soft_delete();


--
-- Name: restaurants restaurants_after_insert_seed_print_stations; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER restaurants_after_insert_seed_print_stations AFTER INSERT ON public.restaurants FOR EACH ROW EXECUTE FUNCTION public.seed_default_print_stations_for_restaurant();


--
-- Name: restaurants restaurants_after_insert_seed_restaurant_tables; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER restaurants_after_insert_seed_restaurant_tables AFTER INSERT ON public.restaurants FOR EACH ROW EXECUTE FUNCTION public.seed_default_restaurant_tables_for_restaurant();


--
-- Name: table_party_group_members table_party_group_members_same_restaurant; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER table_party_group_members_same_restaurant BEFORE INSERT OR UPDATE OF party_id, table_id, restaurant_id ON public.table_party_group_members FOR EACH ROW EXECUTE FUNCTION public.enforce_table_party_member_same_restaurant();


--
-- Name: table_sessions trg_close_table_order_rounds_on_session_status; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_close_table_order_rounds_on_session_status AFTER UPDATE OF status ON public.table_sessions FOR EACH ROW EXECUTE FUNCTION public.close_table_order_rounds_on_session_status();


--
-- Name: kitchen_screen_stations trg_kitchen_screen_station_limit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_kitchen_screen_station_limit BEFORE INSERT OR UPDATE ON public.kitchen_screen_stations FOR EACH ROW EXECUTE FUNCTION public.enforce_kitchen_screen_station_limit();


--
-- Name: abnormal_operations abnormal_operations_confirmed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.abnormal_operations
    ADD CONSTRAINT abnormal_operations_confirmed_by_fkey FOREIGN KEY (confirmed_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: abnormal_operations abnormal_operations_operator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.abnormal_operations
    ADD CONSTRAINT abnormal_operations_operator_id_fkey FOREIGN KEY (operator_id) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: abnormal_operations abnormal_operations_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.abnormal_operations
    ADD CONSTRAINT abnormal_operations_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;


--
-- Name: abnormal_operations abnormal_operations_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.abnormal_operations
    ADD CONSTRAINT abnormal_operations_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: abnormal_operations abnormal_operations_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.abnormal_operations
    ADD CONSTRAINT abnormal_operations_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.table_sessions(id) ON DELETE SET NULL;


--
-- Name: abnormal_operations abnormal_operations_source_action_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.abnormal_operations
    ADD CONSTRAINT abnormal_operations_source_action_id_fkey FOREIGN KEY (source_action_id) REFERENCES public.operation_logs(id) ON DELETE SET NULL;


--
-- Name: abnormal_operations abnormal_operations_table_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.abnormal_operations
    ADD CONSTRAINT abnormal_operations_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.restaurant_tables(id) ON DELETE SET NULL;


--
-- Name: analytics_daily_menu_item_consumption analytics_daily_menu_item_consumption_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_daily_menu_item_consumption
    ADD CONSTRAINT analytics_daily_menu_item_consumption_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: analytics_daily_menu_item_stats analytics_daily_menu_item_stats_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_daily_menu_item_stats
    ADD CONSTRAINT analytics_daily_menu_item_stats_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: analytics_daily_restaurant_stats analytics_daily_restaurant_stats_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_daily_restaurant_stats
    ADD CONSTRAINT analytics_daily_restaurant_stats_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: bill_split_ticket_calls bill_split_ticket_calls_bill_split_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bill_split_ticket_calls
    ADD CONSTRAINT bill_split_ticket_calls_bill_split_id_fkey FOREIGN KEY (bill_split_id) REFERENCES public.bill_splits(id) ON DELETE CASCADE;


--
-- Name: bill_split_ticket_calls bill_split_ticket_calls_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bill_split_ticket_calls
    ADD CONSTRAINT bill_split_ticket_calls_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: bill_split_ticket_calls bill_split_ticket_calls_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bill_split_ticket_calls
    ADD CONSTRAINT bill_split_ticket_calls_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.table_sessions(id) ON DELETE CASCADE;


--
-- Name: bill_splits bill_splits_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bill_splits
    ADD CONSTRAINT bill_splits_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: bill_splits bill_splits_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bill_splits
    ADD CONSTRAINT bill_splits_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.table_sessions(id) ON DELETE SET NULL;


--
-- Name: bill_splits bill_splits_table_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bill_splits
    ADD CONSTRAINT bill_splits_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.restaurant_tables(id) ON DELETE RESTRICT;


--
-- Name: bill_sync_jobs bill_sync_jobs_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bill_sync_jobs
    ADD CONSTRAINT bill_sync_jobs_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: buffet_calendar_overrides buffet_calendar_overrides_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.buffet_calendar_overrides
    ADD CONSTRAINT buffet_calendar_overrides_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: buffet_price_rules buffet_price_rules_buffet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.buffet_price_rules
    ADD CONSTRAINT buffet_price_rules_buffet_id_fkey FOREIGN KEY (buffet_id) REFERENCES public.buffets(id) ON DELETE CASCADE;


--
-- Name: buffet_price_rules buffet_price_rules_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.buffet_price_rules
    ADD CONSTRAINT buffet_price_rules_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: buffet_price_rules buffet_price_rules_time_slot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.buffet_price_rules
    ADD CONSTRAINT buffet_price_rules_time_slot_id_fkey FOREIGN KEY (time_slot_id) REFERENCES public.buffet_time_slots(id) ON DELETE CASCADE;


--
-- Name: buffet_time_slots buffet_time_slots_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.buffet_time_slots
    ADD CONSTRAINT buffet_time_slots_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: buffets buffets_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.buffets
    ADD CONSTRAINT buffets_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: cash_drawer_jobs cash_drawer_jobs_collected_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_drawer_jobs
    ADD CONSTRAINT cash_drawer_jobs_collected_payment_id_fkey FOREIGN KEY (collected_payment_id) REFERENCES public.session_collected_payments(id) ON DELETE SET NULL;


--
-- Name: cash_drawer_jobs cash_drawer_jobs_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_drawer_jobs
    ADD CONSTRAINT cash_drawer_jobs_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: cash_drawer_jobs cash_drawer_jobs_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_drawer_jobs
    ADD CONSTRAINT cash_drawer_jobs_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.table_sessions(id) ON DELETE SET NULL;


--
-- Name: dish_feedback dish_feedback_menu_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dish_feedback
    ADD CONSTRAINT dish_feedback_menu_item_id_fkey FOREIGN KEY (menu_item_id) REFERENCES public.menu_items(id) ON DELETE CASCADE;


--
-- Name: dish_feedback dish_feedback_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dish_feedback
    ADD CONSTRAINT dish_feedback_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: dish_feedback dish_feedback_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dish_feedback
    ADD CONSTRAINT dish_feedback_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: dish_feedback dish_feedback_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dish_feedback
    ADD CONSTRAINT dish_feedback_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.table_sessions(id) ON DELETE CASCADE;


--
-- Name: feedback_sessions feedback_sessions_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedback_sessions
    ADD CONSTRAINT feedback_sessions_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: feedback_sessions feedback_sessions_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedback_sessions
    ADD CONSTRAINT feedback_sessions_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.table_sessions(id) ON DELETE CASCADE;


--
-- Name: fiscal_signing_installations fiscal_signing_installations_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fiscal_signing_installations
    ADD CONSTRAINT fiscal_signing_installations_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: fiscal_terminal_pairings fiscal_terminal_pairings_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fiscal_terminal_pairings
    ADD CONSTRAINT fiscal_terminal_pairings_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: fiscal_terminals fiscal_terminals_pairing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fiscal_terminals
    ADD CONSTRAINT fiscal_terminals_pairing_id_fkey FOREIGN KEY (pairing_id) REFERENCES public.fiscal_terminal_pairings(id);


--
-- Name: fiscal_terminals fiscal_terminals_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fiscal_terminals
    ADD CONSTRAINT fiscal_terminals_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: kitchen_screen_stations kitchen_screen_stations_print_station_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kitchen_screen_stations
    ADD CONSTRAINT kitchen_screen_stations_print_station_id_fkey FOREIGN KEY (print_station_id) REFERENCES public.print_stations(id) ON DELETE CASCADE;


--
-- Name: kitchen_screen_stations kitchen_screen_stations_screen_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kitchen_screen_stations
    ADD CONSTRAINT kitchen_screen_stations_screen_id_fkey FOREIGN KEY (screen_id) REFERENCES public.kitchen_screens(id) ON DELETE CASCADE;


--
-- Name: kitchen_screens kitchen_screens_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kitchen_screens
    ADD CONSTRAINT kitchen_screens_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: menu_categories menu_categories_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_categories
    ADD CONSTRAINT menu_categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.menu_categories(id) ON DELETE CASCADE;


--
-- Name: menu_categories menu_categories_print_station_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_categories
    ADD CONSTRAINT menu_categories_print_station_id_fkey FOREIGN KEY (print_station_id) REFERENCES public.print_stations(id) ON DELETE SET NULL;


--
-- Name: menu_categories menu_categories_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_categories
    ADD CONSTRAINT menu_categories_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: menu_items menu_items_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT menu_items_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.menu_categories(id) ON DELETE SET NULL;


--
-- Name: menu_items menu_items_print_station_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT menu_items_print_station_id_fkey FOREIGN KEY (print_station_id) REFERENCES public.print_stations(id) ON DELETE SET NULL;


--
-- Name: menu_items menu_items_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT menu_items_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: menu_items menu_items_time_slot_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT menu_items_time_slot_fkey FOREIGN KEY (restaurant_id, time_slot_id) REFERENCES public.buffet_time_slots(restaurant_id, id) ON DELETE SET NULL (time_slot_id);


--
-- Name: menu_note_preset_groups menu_note_preset_groups_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_note_preset_groups
    ADD CONSTRAINT menu_note_preset_groups_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: menu_note_presets menu_note_presets_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_note_presets
    ADD CONSTRAINT menu_note_presets_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.menu_note_preset_groups(id) ON DELETE RESTRICT;


--
-- Name: menu_note_presets menu_note_presets_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_note_presets
    ADD CONSTRAINT menu_note_presets_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: menu_recommended_items menu_recommended_items_menu_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_recommended_items
    ADD CONSTRAINT menu_recommended_items_menu_item_id_fkey FOREIGN KEY (menu_item_id) REFERENCES public.menu_items(id) ON DELETE CASCADE;


--
-- Name: menu_recommended_items menu_recommended_items_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_recommended_items
    ADD CONSTRAINT menu_recommended_items_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: operation_logs operation_logs_operator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operation_logs
    ADD CONSTRAINT operation_logs_operator_id_fkey FOREIGN KEY (operator_id) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: operation_logs operation_logs_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operation_logs
    ADD CONSTRAINT operation_logs_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: order_append_idempotency order_append_idempotency_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_append_idempotency
    ADD CONSTRAINT order_append_idempotency_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;


--
-- Name: order_append_idempotency order_append_idempotency_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_append_idempotency
    ADD CONSTRAINT order_append_idempotency_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: order_append_idempotency order_append_idempotency_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_append_idempotency
    ADD CONSTRAINT order_append_idempotency_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.table_sessions(id) ON DELETE CASCADE;


--
-- Name: orders orders_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: orders orders_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.table_sessions(id) ON DELETE SET NULL;


--
-- Name: orders orders_table_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.restaurant_tables(id) ON DELETE RESTRICT;


--
-- Name: platform_admin_accounts platform_admin_accounts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_admin_accounts
    ADD CONSTRAINT platform_admin_accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: platform_admin_audit_log platform_admin_audit_log_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_admin_audit_log
    ADD CONSTRAINT platform_admin_audit_log_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: platform_admin_audit_log platform_admin_audit_log_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_admin_audit_log
    ADD CONSTRAINT platform_admin_audit_log_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE SET NULL;


--
-- Name: print_agent_devices print_agent_devices_pairing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.print_agent_devices
    ADD CONSTRAINT print_agent_devices_pairing_id_fkey FOREIGN KEY (pairing_id) REFERENCES public.print_agent_pairings(id) ON DELETE SET NULL;


--
-- Name: print_agent_devices print_agent_devices_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.print_agent_devices
    ADD CONSTRAINT print_agent_devices_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: print_agent_pairings print_agent_pairings_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.print_agent_pairings
    ADD CONSTRAINT print_agent_pairings_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: print_agent_pairings print_agent_pairings_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.print_agent_pairings
    ADD CONSTRAINT print_agent_pairings_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: print_agent_support_tokens print_agent_support_tokens_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.print_agent_support_tokens
    ADD CONSTRAINT print_agent_support_tokens_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: print_agent_support_tokens print_agent_support_tokens_device_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.print_agent_support_tokens
    ADD CONSTRAINT print_agent_support_tokens_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.print_agent_devices(id) ON DELETE CASCADE;


--
-- Name: print_agent_support_tokens print_agent_support_tokens_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.print_agent_support_tokens
    ADD CONSTRAINT print_agent_support_tokens_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: print_jobs print_jobs_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.print_jobs
    ADD CONSTRAINT print_jobs_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: print_stations print_stations_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.print_stations
    ADD CONSTRAINT print_stations_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: restaurant_installations restaurant_installations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_installations
    ADD CONSTRAINT restaurant_installations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: restaurant_installations restaurant_installations_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_installations
    ADD CONSTRAINT restaurant_installations_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: restaurant_roles restaurant_roles_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_roles
    ADD CONSTRAINT restaurant_roles_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: restaurant_staff_accounts restaurant_staff_accounts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_staff_accounts
    ADD CONSTRAINT restaurant_staff_accounts_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: restaurant_staff_accounts restaurant_staff_accounts_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_staff_accounts
    ADD CONSTRAINT restaurant_staff_accounts_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: restaurant_staff_accounts restaurant_staff_accounts_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_staff_accounts
    ADD CONSTRAINT restaurant_staff_accounts_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.restaurant_roles(id) ON DELETE RESTRICT;


--
-- Name: restaurant_staff_accounts restaurant_staff_accounts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_staff_accounts
    ADD CONSTRAINT restaurant_staff_accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: restaurant_table_group_members restaurant_table_group_members_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_table_group_members
    ADD CONSTRAINT restaurant_table_group_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.restaurant_table_groups(id) ON DELETE CASCADE;


--
-- Name: restaurant_table_group_members restaurant_table_group_members_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_table_group_members
    ADD CONSTRAINT restaurant_table_group_members_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: restaurant_table_group_members restaurant_table_group_members_table_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_table_group_members
    ADD CONSTRAINT restaurant_table_group_members_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.restaurant_tables(id) ON DELETE CASCADE;


--
-- Name: restaurant_table_groups restaurant_table_groups_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_table_groups
    ADD CONSTRAINT restaurant_table_groups_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: restaurant_tables restaurant_tables_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_tables
    ADD CONSTRAINT restaurant_tables_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: restaurants restaurants_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurants
    ADD CONSTRAINT restaurants_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: session_collected_payments session_collected_payments_bill_split_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_collected_payments
    ADD CONSTRAINT session_collected_payments_bill_split_id_fkey FOREIGN KEY (bill_split_id) REFERENCES public.bill_splits(id) ON DELETE SET NULL;


--
-- Name: session_collected_payments session_collected_payments_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_collected_payments
    ADD CONSTRAINT session_collected_payments_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: session_collected_payments session_collected_payments_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_collected_payments
    ADD CONSTRAINT session_collected_payments_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: session_collected_payments session_collected_payments_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_collected_payments
    ADD CONSTRAINT session_collected_payments_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.table_sessions(id) ON DELETE CASCADE;


--
-- Name: table_checkout_signals table_checkout_signals_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_checkout_signals
    ADD CONSTRAINT table_checkout_signals_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: table_checkout_signals table_checkout_signals_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_checkout_signals
    ADD CONSTRAINT table_checkout_signals_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.table_sessions(id) ON DELETE CASCADE;


--
-- Name: table_order_round_clients table_order_round_clients_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_order_round_clients
    ADD CONSTRAINT table_order_round_clients_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: table_order_round_clients table_order_round_clients_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_order_round_clients
    ADD CONSTRAINT table_order_round_clients_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.table_sessions(id) ON DELETE CASCADE;


--
-- Name: table_order_round_lines table_order_round_lines_menu_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_order_round_lines
    ADD CONSTRAINT table_order_round_lines_menu_item_id_fkey FOREIGN KEY (menu_item_id) REFERENCES public.menu_items(id);


--
-- Name: table_order_round_lines table_order_round_lines_round_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_order_round_lines
    ADD CONSTRAINT table_order_round_lines_round_id_fkey FOREIGN KEY (round_id) REFERENCES public.table_order_rounds(id) ON DELETE CASCADE;


--
-- Name: table_order_rounds table_order_rounds_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_order_rounds
    ADD CONSTRAINT table_order_rounds_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: table_order_rounds table_order_rounds_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_order_rounds
    ADD CONSTRAINT table_order_rounds_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.table_sessions(id) ON DELETE CASCADE;


--
-- Name: table_order_rounds table_order_rounds_table_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_order_rounds
    ADD CONSTRAINT table_order_rounds_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.restaurant_tables(id);


--
-- Name: table_party_group_members table_party_group_members_party_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_party_group_members
    ADD CONSTRAINT table_party_group_members_party_id_fkey FOREIGN KEY (party_id) REFERENCES public.table_party_groups(id) ON DELETE CASCADE;


--
-- Name: table_party_group_members table_party_group_members_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_party_group_members
    ADD CONSTRAINT table_party_group_members_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: table_party_group_members table_party_group_members_table_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_party_group_members
    ADD CONSTRAINT table_party_group_members_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.restaurant_tables(id) ON DELETE CASCADE;


--
-- Name: table_party_groups table_party_groups_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_party_groups
    ADD CONSTRAINT table_party_groups_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: table_session_events table_session_events_from_table_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_session_events
    ADD CONSTRAINT table_session_events_from_table_id_fkey FOREIGN KEY (from_table_id) REFERENCES public.restaurant_tables(id);


--
-- Name: table_session_events table_session_events_operator_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_session_events
    ADD CONSTRAINT table_session_events_operator_user_id_fkey FOREIGN KEY (operator_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: table_session_events table_session_events_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_session_events
    ADD CONSTRAINT table_session_events_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: table_session_events table_session_events_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_session_events
    ADD CONSTRAINT table_session_events_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.table_sessions(id) ON DELETE CASCADE;


--
-- Name: table_session_events table_session_events_to_table_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_session_events
    ADD CONSTRAINT table_session_events_to_table_id_fkey FOREIGN KEY (to_table_id) REFERENCES public.restaurant_tables(id);


--
-- Name: table_sessions table_sessions_closed_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_sessions
    ADD CONSTRAINT table_sessions_closed_by_user_id_fkey FOREIGN KEY (closed_by_user_id) REFERENCES auth.users(id);


--
-- Name: table_sessions table_sessions_merge_into_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_sessions
    ADD CONSTRAINT table_sessions_merge_into_session_id_fkey FOREIGN KEY (merge_into_session_id) REFERENCES public.table_sessions(id) ON DELETE SET NULL;


--
-- Name: table_sessions table_sessions_opened_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_sessions
    ADD CONSTRAINT table_sessions_opened_by_user_id_fkey FOREIGN KEY (opened_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: table_sessions table_sessions_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_sessions
    ADD CONSTRAINT table_sessions_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: table_sessions table_sessions_table_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_sessions
    ADD CONSTRAINT table_sessions_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.restaurant_tables(id) ON DELETE RESTRICT;


--
-- Name: abnormal_operations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.abnormal_operations ENABLE ROW LEVEL SECURITY;

--
-- Name: abnormal_operations abnormal_operations_owner_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY abnormal_operations_owner_select ON public.abnormal_operations FOR SELECT TO authenticated USING ((restaurant_id IN ( SELECT restaurants.id
   FROM public.restaurants
  WHERE (restaurants.owner_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: abnormal_operations abnormal_operations_owner_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY abnormal_operations_owner_update ON public.abnormal_operations FOR UPDATE TO authenticated USING ((restaurant_id IN ( SELECT restaurants.id
   FROM public.restaurants
  WHERE (restaurants.owner_id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((restaurant_id IN ( SELECT restaurants.id
   FROM public.restaurants
  WHERE (restaurants.owner_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: analytics_daily_menu_item_consumption; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.analytics_daily_menu_item_consumption ENABLE ROW LEVEL SECURITY;

--
-- Name: analytics_daily_menu_item_consumption analytics_daily_menu_item_consumption_owner_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY analytics_daily_menu_item_consumption_owner_select ON public.analytics_daily_menu_item_consumption FOR SELECT TO authenticated USING ((restaurant_id IN ( SELECT r.id
   FROM public.restaurants r
  WHERE (r.owner_id = auth.uid()))));


--
-- Name: analytics_daily_menu_item_stats; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.analytics_daily_menu_item_stats ENABLE ROW LEVEL SECURITY;

--
-- Name: analytics_daily_menu_item_stats analytics_daily_menu_item_stats_owner_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY analytics_daily_menu_item_stats_owner_select ON public.analytics_daily_menu_item_stats FOR SELECT TO authenticated USING ((restaurant_id IN ( SELECT r.id
   FROM public.restaurants r
  WHERE (r.owner_id = auth.uid()))));


--
-- Name: analytics_daily_restaurant_stats; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.analytics_daily_restaurant_stats ENABLE ROW LEVEL SECURITY;

--
-- Name: analytics_daily_restaurant_stats analytics_daily_restaurant_stats_owner_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY analytics_daily_restaurant_stats_owner_select ON public.analytics_daily_restaurant_stats FOR SELECT TO authenticated USING ((restaurant_id IN ( SELECT r.id
   FROM public.restaurants r
  WHERE (r.owner_id = auth.uid()))));


--
-- Name: bill_split_ticket_calls; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bill_split_ticket_calls ENABLE ROW LEVEL SECURITY;

--
-- Name: bill_splits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bill_splits ENABLE ROW LEVEL SECURITY;

--
-- Name: bill_splits bill_splits_cashier_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bill_splits_cashier_select ON public.bill_splits FOR SELECT TO authenticated USING (public.is_active_restaurant_staff(restaurant_id, ARRAY['cashier'::text]));


--
-- Name: bill_splits bill_splits_frontdesk_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bill_splits_frontdesk_select ON public.bill_splits FOR SELECT TO authenticated USING (public.is_active_restaurant_staff(restaurant_id, ARRAY['frontdesk'::text, 'cashier'::text, 'custom'::text, 'owner'::text]));


--
-- Name: bill_splits bill_splits_owner_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bill_splits_owner_select ON public.bill_splits FOR SELECT TO authenticated USING ((restaurant_id IN ( SELECT restaurants.id
   FROM public.restaurants
  WHERE (restaurants.owner_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: bill_splits bill_splits_owner_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bill_splits_owner_update ON public.bill_splits FOR UPDATE TO authenticated USING ((restaurant_id IN ( SELECT restaurants.id
   FROM public.restaurants
  WHERE (restaurants.owner_id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((restaurant_id IN ( SELECT restaurants.id
   FROM public.restaurants
  WHERE (restaurants.owner_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: bill_sync_jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bill_sync_jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: bill_sync_jobs bill_sync_jobs_print_agent_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bill_sync_jobs_print_agent_select ON public.bill_sync_jobs FOR SELECT TO authenticated USING (public.is_active_restaurant_staff(restaurant_id, ARRAY['print_agent'::text]));


--
-- Name: bill_sync_jobs bill_sync_jobs_staff_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bill_sync_jobs_staff_select ON public.bill_sync_jobs FOR SELECT TO authenticated USING ((public.is_active_restaurant_staff(restaurant_id, ARRAY['kitchen'::text, 'waiter'::text, 'cashier'::text, 'frontdesk'::text, 'print_agent'::text]) OR (restaurant_id IN ( SELECT r.id
   FROM public.restaurants r
  WHERE (r.owner_id = auth.uid())))));


--
-- Name: buffet_calendar_overrides; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.buffet_calendar_overrides ENABLE ROW LEVEL SECURITY;

--
-- Name: buffet_calendar_overrides buffet_calendar_owner_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY buffet_calendar_owner_delete ON public.buffet_calendar_overrides FOR DELETE USING ((restaurant_id IN ( SELECT restaurants.id
   FROM public.restaurants
  WHERE (restaurants.owner_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: buffet_calendar_overrides buffet_calendar_owner_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY buffet_calendar_owner_insert ON public.buffet_calendar_overrides FOR INSERT WITH CHECK ((restaurant_id IN ( SELECT restaurants.id
   FROM public.restaurants
  WHERE (restaurants.owner_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: buffet_calendar_overrides buffet_calendar_owner_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY buffet_calendar_owner_update ON public.buffet_calendar_overrides FOR UPDATE USING ((restaurant_id IN ( SELECT restaurants.id
   FROM public.restaurants
  WHERE (restaurants.owner_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: buffet_calendar_overrides buffet_calendar_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY buffet_calendar_public_read ON public.buffet_calendar_overrides FOR SELECT USING (true);


--
-- Name: buffet_price_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.buffet_price_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: buffet_price_rules buffet_price_rules_owner_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY buffet_price_rules_owner_delete ON public.buffet_price_rules FOR DELETE USING ((restaurant_id IN ( SELECT restaurants.id
   FROM public.restaurants
  WHERE (restaurants.owner_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: buffet_price_rules buffet_price_rules_owner_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY buffet_price_rules_owner_insert ON public.buffet_price_rules FOR INSERT WITH CHECK ((restaurant_id IN ( SELECT restaurants.id
   FROM public.restaurants
  WHERE (restaurants.owner_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: buffet_price_rules buffet_price_rules_owner_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY buffet_price_rules_owner_update ON public.buffet_price_rules FOR UPDATE USING ((restaurant_id IN ( SELECT restaurants.id
   FROM public.restaurants
  WHERE (restaurants.owner_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: buffet_price_rules buffet_price_rules_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY buffet_price_rules_public_read ON public.buffet_price_rules FOR SELECT USING (true);


--
-- Name: buffet_time_slots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.buffet_time_slots ENABLE ROW LEVEL SECURITY;

--
-- Name: buffet_time_slots buffet_time_slots_owner_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY buffet_time_slots_owner_delete ON public.buffet_time_slots FOR DELETE USING ((restaurant_id IN ( SELECT restaurants.id
   FROM public.restaurants
  WHERE (restaurants.owner_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: buffet_time_slots buffet_time_slots_owner_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY buffet_time_slots_owner_insert ON public.buffet_time_slots FOR INSERT WITH CHECK ((restaurant_id IN ( SELECT restaurants.id
   FROM public.restaurants
  WHERE (restaurants.owner_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: buffet_time_slots buffet_time_slots_owner_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY buffet_time_slots_owner_update ON public.buffet_time_slots FOR UPDATE USING ((restaurant_id IN ( SELECT restaurants.id
   FROM public.restaurants
  WHERE (restaurants.owner_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: buffet_time_slots buffet_time_slots_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY buffet_time_slots_public_read ON public.buffet_time_slots FOR SELECT USING (true);


--
-- Name: buffets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.buffets ENABLE ROW LEVEL SECURITY;

--
-- Name: buffets buffets_owner_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY buffets_owner_delete ON public.buffets FOR DELETE USING ((restaurant_id IN ( SELECT restaurants.id
   FROM public.restaurants
  WHERE (restaurants.owner_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: buffets buffets_owner_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY buffets_owner_insert ON public.buffets FOR INSERT WITH CHECK ((restaurant_id IN ( SELECT restaurants.id
   FROM public.restaurants
  WHERE (restaurants.owner_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: buffets buffets_owner_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY buffets_owner_update ON public.buffets FOR UPDATE USING ((restaurant_id IN ( SELECT restaurants.id
   FROM public.restaurants
  WHERE (restaurants.owner_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: buffets buffets_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY buffets_public_read ON public.buffets FOR SELECT USING (true);


--
-- Name: cash_drawer_jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cash_drawer_jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: cash_drawer_jobs cash_drawer_jobs_print_agent_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cash_drawer_jobs_print_agent_select ON public.cash_drawer_jobs FOR SELECT TO authenticated USING (public.is_active_restaurant_staff(restaurant_id, ARRAY['print_agent'::text]));


--
-- Name: dish_feedback; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dish_feedback ENABLE ROW LEVEL SECURITY;

--
-- Name: feedback_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.feedback_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: fiscal_signing_installations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fiscal_signing_installations ENABLE ROW LEVEL SECURITY;

--
-- Name: fiscal_terminal_pairings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fiscal_terminal_pairings ENABLE ROW LEVEL SECURITY;

--
-- Name: fiscal_terminals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fiscal_terminals ENABLE ROW LEVEL SECURITY;

--
-- Name: kitchen_screen_stations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.kitchen_screen_stations ENABLE ROW LEVEL SECURITY;

--
-- Name: kitchen_screen_stations kitchen_screen_stations_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY kitchen_screen_stations_owner_all ON public.kitchen_screen_stations TO authenticated USING ((screen_id IN ( SELECT ks.id
   FROM public.kitchen_screens ks
  WHERE (ks.restaurant_id IN ( SELECT restaurants.id
           FROM public.restaurants
          WHERE (restaurants.owner_id = auth.uid())))))) WITH CHECK ((screen_id IN ( SELECT ks.id
   FROM public.kitchen_screens ks
  WHERE (ks.restaurant_id IN ( SELECT restaurants.id
           FROM public.restaurants
          WHERE (restaurants.owner_id = auth.uid()))))));


--
-- Name: kitchen_screen_stations kitchen_screen_stations_staff_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY kitchen_screen_stations_staff_select ON public.kitchen_screen_stations FOR SELECT TO authenticated USING ((screen_id IN ( SELECT ks.id
   FROM public.kitchen_screens ks
  WHERE public.is_active_restaurant_staff(ks.restaurant_id))));


--
-- Name: kitchen_screens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.kitchen_screens ENABLE ROW LEVEL SECURITY;

--
-- Name: kitchen_screens kitchen_screens_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY kitchen_screens_owner_all ON public.kitchen_screens TO authenticated USING ((restaurant_id IN ( SELECT restaurants.id
   FROM public.restaurants
  WHERE (restaurants.owner_id = auth.uid())))) WITH CHECK ((restaurant_id IN ( SELECT restaurants.id
   FROM public.restaurants
  WHERE (restaurants.owner_id = auth.uid()))));


--
-- Name: kitchen_screens kitchen_screens_staff_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY kitchen_screens_staff_select ON public.kitchen_screens FOR SELECT TO authenticated USING (public.is_active_restaurant_staff(restaurant_id));


--
-- Name: menu_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: menu_categories menu_categories_frontdesk_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY menu_categories_frontdesk_all ON public.menu_categories TO authenticated USING (public.is_active_restaurant_staff(restaurant_id, ARRAY['frontdesk'::text, 'owner'::text])) WITH CHECK (public.is_active_restaurant_staff(restaurant_id, ARRAY['frontdesk'::text, 'owner'::text]));


--
-- Name: menu_categories menu_categories_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY menu_categories_owner_all ON public.menu_categories USING ((restaurant_id IN ( SELECT restaurants.id
   FROM public.restaurants
  WHERE (restaurants.owner_id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((restaurant_id IN ( SELECT restaurants.id
   FROM public.restaurants
  WHERE (restaurants.owner_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: menu_categories menu_categories_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY menu_categories_public_read ON public.menu_categories FOR SELECT USING (true);


--
-- Name: menu_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

--
-- Name: menu_items menu_items_frontdesk_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY menu_items_frontdesk_all ON public.menu_items TO authenticated USING (public.is_active_restaurant_staff(restaurant_id, ARRAY['frontdesk'::text, 'owner'::text])) WITH CHECK (public.is_active_restaurant_staff(restaurant_id, ARRAY['frontdesk'::text, 'owner'::text]));


--
-- Name: menu_items menu_items_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY menu_items_owner_all ON public.menu_items USING ((restaurant_id IN ( SELECT restaurants.id
   FROM public.restaurants
  WHERE (restaurants.owner_id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((restaurant_id IN ( SELECT restaurants.id
   FROM public.restaurants
  WHERE (restaurants.owner_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: menu_items menu_items_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY menu_items_public_read ON public.menu_items FOR SELECT USING (true);


--
-- Name: menu_note_preset_groups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.menu_note_preset_groups ENABLE ROW LEVEL SECURITY;

--
-- Name: menu_note_preset_groups menu_note_preset_groups_frontdesk_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY menu_note_preset_groups_frontdesk_all ON public.menu_note_preset_groups TO authenticated USING (public.is_active_restaurant_staff(restaurant_id, ARRAY['frontdesk'::text, 'owner'::text])) WITH CHECK (public.is_active_restaurant_staff(restaurant_id, ARRAY['frontdesk'::text, 'owner'::text]));


--
-- Name: menu_note_preset_groups menu_note_preset_groups_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY menu_note_preset_groups_owner_all ON public.menu_note_preset_groups USING ((restaurant_id IN ( SELECT restaurants.id
   FROM public.restaurants
  WHERE (restaurants.owner_id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((restaurant_id IN ( SELECT restaurants.id
   FROM public.restaurants
  WHERE (restaurants.owner_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: menu_note_preset_groups menu_note_preset_groups_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY menu_note_preset_groups_select ON public.menu_note_preset_groups FOR SELECT USING (true);


--
-- Name: menu_note_presets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.menu_note_presets ENABLE ROW LEVEL SECURITY;

--
-- Name: menu_note_presets menu_note_presets_frontdesk_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY menu_note_presets_frontdesk_all ON public.menu_note_presets TO authenticated USING (public.is_active_restaurant_staff(restaurant_id, ARRAY['frontdesk'::text, 'owner'::text])) WITH CHECK (public.is_active_restaurant_staff(restaurant_id, ARRAY['frontdesk'::text, 'owner'::text]));


--
-- Name: menu_note_presets menu_note_presets_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY menu_note_presets_owner_all ON public.menu_note_presets USING ((restaurant_id IN ( SELECT restaurants.id
   FROM public.restaurants
  WHERE (restaurants.owner_id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((restaurant_id IN ( SELECT restaurants.id
   FROM public.restaurants
  WHERE (restaurants.owner_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: menu_note_presets menu_note_presets_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY menu_note_presets_select ON public.menu_note_presets FOR SELECT USING (true);


--
-- Name: menu_recommended_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.menu_recommended_items ENABLE ROW LEVEL SECURITY;

--
-- Name: menu_recommended_items menu_recommended_items_frontdesk_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY menu_recommended_items_frontdesk_all ON public.menu_recommended_items TO authenticated USING (public.is_active_restaurant_staff(restaurant_id, ARRAY['frontdesk'::text])) WITH CHECK (public.is_active_restaurant_staff(restaurant_id, ARRAY['frontdesk'::text]));


--
-- Name: menu_recommended_items menu_recommended_items_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY menu_recommended_items_owner_all ON public.menu_recommended_items USING ((restaurant_id IN ( SELECT restaurants.id
   FROM public.restaurants
  WHERE (restaurants.owner_id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((restaurant_id IN ( SELECT restaurants.id
   FROM public.restaurants
  WHERE (restaurants.owner_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: menu_recommended_items menu_recommended_items_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY menu_recommended_items_select ON public.menu_recommended_items FOR SELECT USING (true);


--
-- Name: operation_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.operation_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: order_append_idempotency; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_append_idempotency ENABLE ROW LEVEL SECURITY;

--
-- Name: orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

--
-- Name: orders orders_anon_select_open_session; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orders_anon_select_open_session ON public.orders FOR SELECT TO anon USING (public.table_session_is_open_or_billing(session_id));


--
-- Name: orders orders_cashier_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orders_cashier_select ON public.orders FOR SELECT TO authenticated USING (public.is_active_restaurant_staff(restaurant_id, ARRAY['cashier'::text]));


--
-- Name: orders orders_frontdesk_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orders_frontdesk_select ON public.orders FOR SELECT TO authenticated USING (public.is_active_restaurant_staff(restaurant_id, ARRAY['frontdesk'::text, 'cashier'::text, 'waiter'::text, 'custom'::text, 'owner'::text]));


--
-- Name: orders orders_kitchen_staff_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orders_kitchen_staff_select ON public.orders FOR SELECT TO authenticated USING (public.is_active_restaurant_staff(restaurant_id, ARRAY['kitchen'::text]));


--
-- Name: orders orders_owner_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orders_owner_select ON public.orders FOR SELECT TO authenticated USING ((restaurant_id IN ( SELECT restaurants.id
   FROM public.restaurants
  WHERE (restaurants.owner_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: orders orders_owner_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orders_owner_update ON public.orders FOR UPDATE USING ((restaurant_id IN ( SELECT restaurants.id
   FROM public.restaurants
  WHERE (restaurants.owner_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: orders orders_staff_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orders_staff_select ON public.orders FOR SELECT TO authenticated USING (public.is_active_restaurant_staff(restaurant_id));


--
-- Name: orders orders_staff_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orders_staff_update ON public.orders FOR UPDATE TO authenticated USING (public.is_active_restaurant_staff(restaurant_id, ARRAY['kitchen'::text, 'waiter'::text])) WITH CHECK (public.is_active_restaurant_staff(restaurant_id, ARRAY['kitchen'::text, 'waiter'::text]));


--
-- Name: platform_admin_accounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.platform_admin_accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_admin_audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.platform_admin_audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_pro_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.platform_pro_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: print_agent_devices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.print_agent_devices ENABLE ROW LEVEL SECURITY;

--
-- Name: print_agent_devices print_agent_devices_owner_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY print_agent_devices_owner_select ON public.print_agent_devices FOR SELECT USING ((restaurant_id IN ( SELECT restaurants.id
   FROM public.restaurants
  WHERE (restaurants.owner_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: print_agent_pairings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.print_agent_pairings ENABLE ROW LEVEL SECURITY;

--
-- Name: print_agent_pairings print_agent_pairings_owner_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY print_agent_pairings_owner_insert ON public.print_agent_pairings FOR INSERT WITH CHECK ((restaurant_id IN ( SELECT restaurants.id
   FROM public.restaurants
  WHERE (restaurants.owner_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: print_agent_pairings print_agent_pairings_owner_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY print_agent_pairings_owner_select ON public.print_agent_pairings FOR SELECT USING ((restaurant_id IN ( SELECT restaurants.id
   FROM public.restaurants
  WHERE (restaurants.owner_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: print_agent_pairings print_agent_pairings_owner_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY print_agent_pairings_owner_update ON public.print_agent_pairings FOR UPDATE USING ((restaurant_id IN ( SELECT restaurants.id
   FROM public.restaurants
  WHERE (restaurants.owner_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: print_agent_support_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.print_agent_support_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: print_jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.print_jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: print_jobs print_jobs_owner_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY print_jobs_owner_delete ON public.print_jobs FOR DELETE USING ((restaurant_id IN ( SELECT restaurants.id
   FROM public.restaurants
  WHERE (restaurants.owner_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: print_jobs print_jobs_owner_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY print_jobs_owner_insert ON public.print_jobs FOR INSERT WITH CHECK ((restaurant_id IN ( SELECT restaurants.id
   FROM public.restaurants
  WHERE (restaurants.owner_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: print_jobs print_jobs_owner_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY print_jobs_owner_select ON public.print_jobs FOR SELECT USING ((restaurant_id IN ( SELECT restaurants.id
   FROM public.restaurants
  WHERE (restaurants.owner_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: print_jobs print_jobs_owner_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY print_jobs_owner_update ON public.print_jobs FOR UPDATE USING ((restaurant_id IN ( SELECT restaurants.id
   FROM public.restaurants
  WHERE (restaurants.owner_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: print_jobs print_jobs_print_agent_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY print_jobs_print_agent_select ON public.print_jobs FOR SELECT TO authenticated USING (public.is_active_restaurant_staff(restaurant_id, ARRAY['print_agent'::text]));


--
-- Name: print_stations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.print_stations ENABLE ROW LEVEL SECURITY;

--
-- Name: print_stations print_stations_frontdesk_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY print_stations_frontdesk_all ON public.print_stations TO authenticated USING (public.is_active_restaurant_staff(restaurant_id, ARRAY['frontdesk'::text, 'owner'::text])) WITH CHECK (public.is_active_restaurant_staff(restaurant_id, ARRAY['frontdesk'::text, 'owner'::text]));


--
-- Name: print_stations print_stations_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY print_stations_owner_all ON public.print_stations USING ((restaurant_id IN ( SELECT restaurants.id
   FROM public.restaurants
  WHERE (restaurants.owner_id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((restaurant_id IN ( SELECT restaurants.id
   FROM public.restaurants
  WHERE (restaurants.owner_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: print_stations print_stations_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY print_stations_public_read ON public.print_stations FOR SELECT USING (true);


--
-- Name: restaurant_installations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.restaurant_installations ENABLE ROW LEVEL SECURITY;

--
-- Name: restaurant_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.restaurant_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: restaurant_roles restaurant_roles_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY restaurant_roles_owner_all ON public.restaurant_roles TO authenticated USING ((restaurant_id IN ( SELECT restaurants.id
   FROM public.restaurants
  WHERE (restaurants.owner_id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((restaurant_id IN ( SELECT restaurants.id
   FROM public.restaurants
  WHERE (restaurants.owner_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: restaurant_roles restaurant_roles_staff_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY restaurant_roles_staff_select ON public.restaurant_roles FOR SELECT TO authenticated USING (public.is_active_restaurant_staff(restaurant_id, ARRAY['kitchen'::text, 'waiter'::text, 'cashier'::text, 'frontdesk'::text, 'custom'::text, 'owner'::text]));


--
-- Name: restaurant_staff_accounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.restaurant_staff_accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: restaurant_staff_accounts restaurant_staff_accounts_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY restaurant_staff_accounts_owner_all ON public.restaurant_staff_accounts TO authenticated USING ((restaurant_id IN ( SELECT public.auth_owned_restaurant_ids() AS auth_owned_restaurant_ids))) WITH CHECK ((restaurant_id IN ( SELECT public.auth_owned_restaurant_ids() AS auth_owned_restaurant_ids)));


--
-- Name: restaurant_staff_accounts restaurant_staff_accounts_staff_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY restaurant_staff_accounts_staff_select_own ON public.restaurant_staff_accounts FOR SELECT TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) AND (disabled_at IS NULL)));


--
-- Name: restaurant_table_group_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.restaurant_table_group_members ENABLE ROW LEVEL SECURITY;

--
-- Name: restaurant_table_group_members restaurant_table_group_members_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY restaurant_table_group_members_owner_all ON public.restaurant_table_group_members USING ((restaurant_id IN ( SELECT restaurants.id
   FROM public.restaurants
  WHERE (restaurants.owner_id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((restaurant_id IN ( SELECT restaurants.id
   FROM public.restaurants
  WHERE (restaurants.owner_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: restaurant_table_group_members restaurant_table_group_members_staff_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY restaurant_table_group_members_staff_select ON public.restaurant_table_group_members FOR SELECT TO authenticated USING (public.is_active_restaurant_staff(restaurant_id, ARRAY['kitchen'::text, 'waiter'::text, 'cashier'::text]));


--
-- Name: restaurant_table_groups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.restaurant_table_groups ENABLE ROW LEVEL SECURITY;

--
-- Name: restaurant_table_groups restaurant_table_groups_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY restaurant_table_groups_owner_all ON public.restaurant_table_groups USING ((restaurant_id IN ( SELECT restaurants.id
   FROM public.restaurants
  WHERE (restaurants.owner_id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((restaurant_id IN ( SELECT restaurants.id
   FROM public.restaurants
  WHERE (restaurants.owner_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: restaurant_table_groups restaurant_table_groups_staff_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY restaurant_table_groups_staff_select ON public.restaurant_table_groups FOR SELECT TO authenticated USING (public.is_active_restaurant_staff(restaurant_id, ARRAY['kitchen'::text, 'waiter'::text, 'cashier'::text]));


--
-- Name: restaurant_tables; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;

--
-- Name: restaurant_tables restaurant_tables_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY restaurant_tables_owner_all ON public.restaurant_tables USING ((restaurant_id IN ( SELECT restaurants.id
   FROM public.restaurants
  WHERE (restaurants.owner_id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((restaurant_id IN ( SELECT restaurants.id
   FROM public.restaurants
  WHERE (restaurants.owner_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: restaurant_tables restaurant_tables_staff_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY restaurant_tables_staff_select ON public.restaurant_tables FOR SELECT TO authenticated USING (((deleted_at IS NULL) AND public.is_active_restaurant_staff(restaurant_id, ARRAY['kitchen'::text, 'waiter'::text, 'cashier'::text])));


--
-- Name: restaurants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;

--
-- Name: restaurants restaurants_delete_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY restaurants_delete_own ON public.restaurants FOR DELETE USING ((owner_id = ( SELECT auth.uid() AS uid)));


--
-- Name: restaurants restaurants_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY restaurants_insert_own ON public.restaurants FOR INSERT WITH CHECK ((owner_id = ( SELECT auth.uid() AS uid)));


--
-- Name: restaurants restaurants_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY restaurants_select_own ON public.restaurants FOR SELECT USING ((owner_id = ( SELECT auth.uid() AS uid)));


--
-- Name: restaurants restaurants_staff_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY restaurants_staff_select_own ON public.restaurants FOR SELECT TO authenticated USING ((id IN ( SELECT public.auth_staff_restaurant_ids() AS auth_staff_restaurant_ids)));


--
-- Name: restaurants restaurants_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY restaurants_update_own ON public.restaurants FOR UPDATE USING ((owner_id = ( SELECT auth.uid() AS uid)));


--
-- Name: session_collected_payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.session_collected_payments ENABLE ROW LEVEL SECURITY;

--
-- Name: session_collected_payments session_collected_payments_cashier_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY session_collected_payments_cashier_select ON public.session_collected_payments FOR SELECT TO authenticated USING (public.is_active_restaurant_staff(restaurant_id, ARRAY['cashier'::text]));


--
-- Name: session_collected_payments session_collected_payments_frontdesk_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY session_collected_payments_frontdesk_select ON public.session_collected_payments FOR SELECT TO authenticated USING (public.is_active_restaurant_staff(restaurant_id, ARRAY['frontdesk'::text]));


--
-- Name: session_collected_payments session_collected_payments_owner_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY session_collected_payments_owner_select ON public.session_collected_payments FOR SELECT TO authenticated USING ((restaurant_id IN ( SELECT restaurants.id
   FROM public.restaurants
  WHERE (restaurants.owner_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: table_checkout_signals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.table_checkout_signals ENABLE ROW LEVEL SECURITY;

--
-- Name: table_checkout_signals table_checkout_signals_select_open_session; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY table_checkout_signals_select_open_session ON public.table_checkout_signals FOR SELECT TO authenticated, anon USING (public.table_session_allows_checkout_signals(session_id));


--
-- Name: table_order_round_clients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.table_order_round_clients ENABLE ROW LEVEL SECURITY;

--
-- Name: table_order_round_lines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.table_order_round_lines ENABLE ROW LEVEL SECURITY;

--
-- Name: table_order_round_lines table_order_round_lines_select_open_session; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY table_order_round_lines_select_open_session ON public.table_order_round_lines FOR SELECT TO authenticated, anon USING ((EXISTS ( SELECT 1
   FROM public.table_order_rounds r
  WHERE ((r.id = table_order_round_lines.round_id) AND public.table_session_is_open_or_billing(r.session_id)))));


--
-- Name: table_order_rounds; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.table_order_rounds ENABLE ROW LEVEL SECURITY;

--
-- Name: table_order_rounds table_order_rounds_select_open_session; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY table_order_rounds_select_open_session ON public.table_order_rounds FOR SELECT TO authenticated, anon USING (public.table_session_is_open_or_billing(session_id));


--
-- Name: table_party_group_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.table_party_group_members ENABLE ROW LEVEL SECURITY;

--
-- Name: table_party_group_members table_party_group_members_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY table_party_group_members_owner_all ON public.table_party_group_members USING ((restaurant_id IN ( SELECT restaurants.id
   FROM public.restaurants
  WHERE (restaurants.owner_id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((restaurant_id IN ( SELECT restaurants.id
   FROM public.restaurants
  WHERE (restaurants.owner_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: table_party_group_members table_party_group_members_staff_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY table_party_group_members_staff_select ON public.table_party_group_members FOR SELECT TO authenticated USING (public.is_active_restaurant_staff(restaurant_id, ARRAY['kitchen'::text, 'waiter'::text, 'cashier'::text]));


--
-- Name: table_party_groups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.table_party_groups ENABLE ROW LEVEL SECURITY;

--
-- Name: table_party_groups table_party_groups_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY table_party_groups_owner_all ON public.table_party_groups USING ((restaurant_id IN ( SELECT restaurants.id
   FROM public.restaurants
  WHERE (restaurants.owner_id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((restaurant_id IN ( SELECT restaurants.id
   FROM public.restaurants
  WHERE (restaurants.owner_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: table_party_groups table_party_groups_staff_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY table_party_groups_staff_select ON public.table_party_groups FOR SELECT TO authenticated USING (public.is_active_restaurant_staff(restaurant_id, ARRAY['kitchen'::text, 'waiter'::text, 'cashier'::text]));


--
-- Name: table_session_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.table_session_events ENABLE ROW LEVEL SECURITY;

--
-- Name: table_session_events table_session_events_owner_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY table_session_events_owner_select ON public.table_session_events FOR SELECT TO authenticated USING ((restaurant_id IN ( SELECT restaurants.id
   FROM public.restaurants
  WHERE (restaurants.owner_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: table_session_events table_session_events_staff_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY table_session_events_staff_select ON public.table_session_events FOR SELECT TO authenticated USING (public.is_active_restaurant_staff(restaurant_id, ARRAY['waiter'::text, 'frontdesk'::text, 'cashier'::text, 'owner'::text]));


--
-- Name: table_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.table_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: table_sessions table_sessions_anon_select_open_billing; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY table_sessions_anon_select_open_billing ON public.table_sessions FOR SELECT TO anon USING ((status = ANY (ARRAY['open'::text, 'billing'::text])));


--
-- Name: POLICY table_sessions_anon_select_open_billing ON table_sessions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON POLICY table_sessions_anon_select_open_billing ON public.table_sessions IS 'Anon Realtime CDC for guest menu table_id doorbell (开台 discovery). Only open|billing; closed rows remain hidden.';


--
-- Name: table_sessions table_sessions_owner_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY table_sessions_owner_select ON public.table_sessions FOR SELECT TO authenticated USING ((restaurant_id IN ( SELECT restaurants.id
   FROM public.restaurants
  WHERE (restaurants.owner_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: table_sessions table_sessions_owner_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY table_sessions_owner_update ON public.table_sessions FOR UPDATE TO authenticated USING ((restaurant_id IN ( SELECT restaurants.id
   FROM public.restaurants
  WHERE (restaurants.owner_id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((restaurant_id IN ( SELECT restaurants.id
   FROM public.restaurants
  WHERE (restaurants.owner_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: table_sessions table_sessions_staff_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY table_sessions_staff_select ON public.table_sessions FOR SELECT TO authenticated USING (public.staff_has_restaurant_permission(restaurant_id, ARRAY['dashboard.waiter_board.view'::text, 'floor.waiter_board.view'::text]));


--
-- PostgreSQL database dump complete
--

\unrestrict VBpwvkmyHt0sFsZLKaHBvih8Juw4M8enB0EmNwYdC7rKi5QqMw0imJ78bxurLvC

