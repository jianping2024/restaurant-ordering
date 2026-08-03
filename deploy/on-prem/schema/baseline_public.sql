--
-- PostgreSQL database dump
--

\restrict HAgFUAFrXf3cz3cvCIg6BcjkP3F3favG53FGtporqhN5cSqYUb1ghIJgnfnWC1o

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
      AND a.role = ANY (ARRAY['frontdesk', 'owner', 'custom']::text[])
      AND a.disabled_at IS NULL
  )
  INTO v_is_operator;

  IF NOT v_is_operator THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'forbidden',
      'message', 'unpaid_close_role_forbidden'
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

COMMENT ON FUNCTION public.close_table_session_manual(p_restaurant_id uuid, p_table_id uuid, p_operator_user_id uuid, p_closed_reason text, p_confirm_close boolean, p_unpaid_reason text, p_unpaid_reason_detail text) IS 'Manual unpaid/force close. Operator: restaurant owner_id or active staff role frontdesk|owner|custom. App enforces tables.force_close.';


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
-- Name: close_table_session_settled(uuid, uuid, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.close_table_session_settled(p_restaurant_id uuid, p_table_id uuid, p_closed_reason text, p_closed_by_user_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
-- Name: confirm_bill_split_payment(uuid, uuid, integer, numeric, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.confirm_bill_split_payment(p_restaurant_id uuid, p_bill_split_id uuid, p_person_index integer, p_collected_amount numeric DEFAULT NULL::numeric, p_created_by_user_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: dashboard_overview_revenue_bundle(uuid, timestamp with time zone, timestamp with time zone, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.dashboard_overview_revenue_bundle(p_restaurant_id uuid, p_start_utc timestamp with time zone, p_end_exclusive_utc timestamp with time zone, p_max_sessions integer DEFAULT 2000) RETURNS jsonb
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public'
    AS $$
DECLARE
  v_session_count integer;
  v_sessions jsonb;
  v_orders jsonb;
  v_splits jsonb;
  v_unpaid jsonb;
BEGIN
  SELECT count(*)::integer
  INTO v_session_count
  FROM public.table_sessions ts
  WHERE ts.restaurant_id = p_restaurant_id
    AND ts.status = 'closed'
    AND ts.closed_at IS NOT NULL
    AND ts.closed_at >= p_start_utc
    AND ts.closed_at < p_end_exclusive_utc;

  IF v_session_count > greatest(coalesce(p_max_sessions, 2000), 1) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'query_limit_exceeded',
      'session_count', v_session_count
    );
  END IF;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', ts.id,
        'closed_at', ts.closed_at,
        'closed_reason', ts.closed_reason
      )
      ORDER BY ts.closed_at
    ),
    '[]'::jsonb
  )
  INTO v_sessions
  FROM public.table_sessions ts
  WHERE ts.restaurant_id = p_restaurant_id
    AND ts.status = 'closed'
    AND ts.closed_at IS NOT NULL
    AND ts.closed_at >= p_start_utc
    AND ts.closed_at < p_end_exclusive_utc;

  IF v_session_count = 0 THEN
    RETURN jsonb_build_object(
      'ok', true,
      'sessions', '[]'::jsonb,
      'orders', '[]'::jsonb,
      'splits', '[]'::jsonb,
      'unpaid_session_ids', '[]'::jsonb
    );
  END IF;

  SELECT coalesce(
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
  INTO v_orders
  FROM public.orders o
  WHERE o.restaurant_id = p_restaurant_id
    AND o.session_id IN (
      SELECT ts.id
      FROM public.table_sessions ts
      WHERE ts.restaurant_id = p_restaurant_id
        AND ts.status = 'closed'
        AND ts.closed_at IS NOT NULL
        AND ts.closed_at >= p_start_utc
        AND ts.closed_at < p_end_exclusive_utc
    );

  SELECT coalesce(
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
  INTO v_splits
  FROM public.bill_splits bs
  WHERE bs.restaurant_id = p_restaurant_id
    AND bs.session_id IN (
      SELECT ts.id
      FROM public.table_sessions ts
      WHERE ts.restaurant_id = p_restaurant_id
        AND ts.status = 'closed'
        AND ts.closed_at IS NOT NULL
        AND ts.closed_at >= p_start_utc
        AND ts.closed_at < p_end_exclusive_utc
    );

  SELECT coalesce(jsonb_agg(DISTINCT ao.session_id), '[]'::jsonb)
  INTO v_unpaid
  FROM public.abnormal_operations ao
  WHERE ao.restaurant_id = p_restaurant_id
    AND ao.type = 'UNPAID_TABLE_CLOSED'
    AND ao.session_id IN (
      SELECT ts.id
      FROM public.table_sessions ts
      WHERE ts.restaurant_id = p_restaurant_id
        AND ts.status = 'closed'
        AND ts.closed_at IS NOT NULL
        AND ts.closed_at >= p_start_utc
        AND ts.closed_at < p_end_exclusive_utc
    );

  RETURN jsonb_build_object(
    'ok', true,
    'sessions', v_sessions,
    'orders', v_orders,
    'splits', v_splits,
    'unpaid_session_ids', v_unpaid
  );
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

  for v_i in 0 .. v_len - 1 loop
    v_row := p_result -> v_i;
    v_obligation := public.checkout_round_discount_amount(
      coalesce((v_row ->> 'amount')::numeric, 0),
      p_discount_rate
    );
    v_collected := public.session_person_collected_by_index(
      p_restaurant_id,
      p_session_id,
      v_i
    );
    v_row := v_row || jsonb_build_object(
      'paid',
      round(v_collected, 2) >= round(v_obligation, 2)
    );
    v_result := v_result || jsonb_build_array(v_row);
  end loop;

  return v_result;
end;
$$;


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

    if v_len <= 1 then
      if v_has_partial_payment then
        return jsonb_build_object('ok', false, 'code', 'whole_table_paid');
      end if;
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
  select coalesce(sum(amount), 0)
  from public.session_collected_payments
  where restaurant_id = p_restaurant_id
    and session_id = p_session_id
    and person_index = p_person_index;
$$;


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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.buffets REPLICA IDENTITY FULL;


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
    note_preset_keys text[] DEFAULT '{}'::text[] NOT NULL,
    category_en text,
    category_zh text,
    category_id uuid,
    print_station_id uuid,
    item_code character varying(10),
    vat_rate numeric(5,2) DEFAULT 23 NOT NULL,
    per_person_qty_limit integer,
    over_limit_unit_price numeric,
    CONSTRAINT menu_items_limit_requires_overage_price CHECK ((((per_person_qty_limit IS NULL) AND (over_limit_unit_price IS NULL)) OR ((per_person_qty_limit IS NOT NULL) AND (over_limit_unit_price IS NOT NULL)))),
    CONSTRAINT menu_items_over_limit_unit_price_check CHECK (((over_limit_unit_price IS NULL) OR (over_limit_unit_price >= (0)::numeric))),
    CONSTRAINT menu_items_per_person_qty_limit_check CHECK (((per_person_qty_limit IS NULL) OR (per_person_qty_limit >= 1))),
    CONSTRAINT menu_items_vat_rate_range CHECK (((vat_rate >= (0)::numeric) AND (vat_rate <= (100)::numeric)))
);


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
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


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
-- Name: restaurant_service_entitlements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.restaurant_service_entitlements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid,
    instance_id text,
    instance_secret_hash text,
    display_name text,
    valid_from timestamp with time zone NOT NULL,
    valid_until timestamp with time zone NOT NULL,
    paused boolean DEFAULT false NOT NULL,
    pause_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT restaurant_service_entitlements_subject_check CHECK (((restaurant_id IS NOT NULL) OR (instance_id IS NOT NULL))),
    CONSTRAINT restaurant_service_entitlements_window_check CHECK ((valid_until > valid_from))
);


--
-- Name: TABLE restaurant_service_entitlements; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.restaurant_service_entitlements IS 'Platform service term + pause (ADR-004). Lease JWT TTL is separate; business stop uses valid_until/paused → suspended_at.';


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
    plan text DEFAULT 'free'::text NOT NULL,
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
    license_valid_until timestamp with time zone,
    buffet_service_mode text DEFAULT 'classic'::text NOT NULL,
    guest_ordering_notice jsonb DEFAULT jsonb_build_object('enabled', false, 'title', jsonb_build_object('pt', '', 'en', '', 'zh', ''), 'body', jsonb_build_object('pt', '', 'en', '', 'zh', ''), 'updated_at', NULL::unknown) NOT NULL,
    permissions_version integer DEFAULT 0 NOT NULL,
    deployment_mode text DEFAULT 'cloud'::text NOT NULL,
    owner_email text,
    license_checked_at timestamp with time zone,
    license_lease_until timestamp with time zone,
    license_lease_token text,
    CONSTRAINT restaurants_buffet_service_mode_check CHECK ((buffet_service_mode = ANY (ARRAY['classic'::text, 'sushi'::text]))),
    CONSTRAINT restaurants_cloud_owner_required CHECK (((deployment_mode <> 'cloud'::text) OR (owner_id IS NOT NULL))),
    CONSTRAINT restaurants_country_code_check CHECK ((country_code ~ '^[A-Z]{2}$'::text)),
    CONSTRAINT restaurants_deployment_mode_check CHECK ((deployment_mode = ANY (ARRAY['cloud'::text, 'on_prem'::text]))),
    CONSTRAINT restaurants_order_cooldown_seconds_check CHECK (((order_cooldown_seconds >= 5) AND (order_cooldown_seconds <= 60))),
    CONSTRAINT restaurants_order_radius_meters_check CHECK (((order_radius_meters >= 10) AND (order_radius_meters <= 10000))),
    CONSTRAINT restaurants_plan_check CHECK ((plan = ANY (ARRAY['free'::text, 'pro'::text]))),
    CONSTRAINT restaurants_print_locale_check CHECK ((print_locale = ANY (ARRAY['zh'::text, 'en'::text, 'pt'::text])))
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
-- Name: COLUMN restaurants.license_valid_until; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.restaurants.license_valid_until IS 'Platform license end; null = no expiry. Materialize into suspended_at when past.';


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
-- Name: restaurants_public; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.restaurants_public WITH (security_invoker='false') AS
 SELECT id,
    name,
    slug,
    logo_url,
    address,
    phone,
    plan,
    geo_latitude,
    geo_longitude,
    print_locale,
    created_at,
    order_radius_meters,
    buffet_service_mode,
    guest_ordering_notice
   FROM public.restaurants;


--
-- Name: VIEW restaurants_public; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.restaurants_public IS 'Public restaurant fields for ordering surfaces (no passwords); includes buffet_service_mode and guest_ordering_notice.';


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
    CONSTRAINT session_collected_payments_amount_check CHECK ((amount > (0)::numeric))
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
-- Name: abnormal_operations abnormal_operations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.abnormal_operations
    ADD CONSTRAINT abnormal_operations_pkey PRIMARY KEY (id);


--
-- Name: analytics_daily_restaurant_stats analytics_daily_restaurant_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_daily_restaurant_stats
    ADD CONSTRAINT analytics_daily_restaurant_stats_pkey PRIMARY KEY (restaurant_id, business_date);


--
-- Name: bill_splits bill_splits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bill_splits
    ADD CONSTRAINT bill_splits_pkey PRIMARY KEY (id);


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
-- Name: buffets buffets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.buffets
    ADD CONSTRAINT buffets_pkey PRIMARY KEY (id);


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
-- Name: restaurant_service_entitlements restaurant_service_entitlements_instance_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_service_entitlements
    ADD CONSTRAINT restaurant_service_entitlements_instance_id_key UNIQUE (instance_id);


--
-- Name: restaurant_service_entitlements restaurant_service_entitlements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_service_entitlements
    ADD CONSTRAINT restaurant_service_entitlements_pkey PRIMARY KEY (id);


--
-- Name: restaurant_service_entitlements restaurant_service_entitlements_restaurant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_service_entitlements
    ADD CONSTRAINT restaurant_service_entitlements_restaurant_id_key UNIQUE (restaurant_id);


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
-- Name: idx_entitlements_valid_until; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_entitlements_valid_until ON public.restaurant_service_entitlements USING btree (valid_until);


--
-- Name: idx_feedback_sessions_restaurant_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feedback_sessions_restaurant_created ON public.feedback_sessions USING btree (restaurant_id, created_at DESC);


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
-- Name: idx_menu_items_note_preset_keys; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_menu_items_note_preset_keys ON public.menu_items USING gin (note_preset_keys);


--
-- Name: idx_menu_items_print_station; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_menu_items_print_station ON public.menu_items USING btree (restaurant_id, print_station_id) WHERE (print_station_id IS NOT NULL);


--
-- Name: idx_menu_items_restaurant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_menu_items_restaurant ON public.menu_items USING btree (restaurant_id);


--
-- Name: idx_menu_items_uncategorized_sort_order; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_menu_items_uncategorized_sort_order ON public.menu_items USING btree (restaurant_id, sort_order) WHERE (category_id IS NULL);


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
-- Name: abnormal_operations abnormal_operations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER abnormal_operations_updated_at BEFORE UPDATE ON public.abnormal_operations FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


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
-- Name: analytics_daily_restaurant_stats analytics_daily_restaurant_stats_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_daily_restaurant_stats
    ADD CONSTRAINT analytics_daily_restaurant_stats_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


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
-- Name: restaurant_service_entitlements restaurant_service_entitlements_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_service_entitlements
    ADD CONSTRAINT restaurant_service_entitlements_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


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
-- Name: dish_feedback; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dish_feedback ENABLE ROW LEVEL SECURITY;

--
-- Name: dish_feedback dish_feedback_public_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY dish_feedback_public_all ON public.dish_feedback USING (true) WITH CHECK (true);


--
-- Name: feedback_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.feedback_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: feedback_sessions feedback_sessions_public_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY feedback_sessions_public_all ON public.feedback_sessions USING (true) WITH CHECK (true);


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
-- Name: orders orders_cashier_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orders_cashier_select ON public.orders FOR SELECT TO authenticated USING (public.is_active_restaurant_staff(restaurant_id, ARRAY['cashier'::text]));


--
-- Name: orders orders_frontdesk_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orders_frontdesk_select ON public.orders FOR SELECT TO authenticated USING (public.is_active_restaurant_staff(restaurant_id, ARRAY['frontdesk'::text, 'cashier'::text, 'waiter'::text, 'custom'::text, 'owner'::text]));


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
-- Name: orders orders_public_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orders_public_insert ON public.orders FOR INSERT WITH CHECK (true);


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
-- Name: restaurant_service_entitlements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.restaurant_service_entitlements ENABLE ROW LEVEL SECURITY;

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

CREATE POLICY table_sessions_staff_select ON public.table_sessions FOR SELECT TO authenticated USING (public.is_active_restaurant_staff(restaurant_id));


--
-- PostgreSQL database dump complete
--

\unrestrict HAgFUAFrXf3cz3cvCIg6BcjkP3F3favG53FGtporqhN5cSqYUb1ghIJgnfnWC1o

