-- Serial guest round-line writes: session advisory lock + FOR UPDATE active round,
-- then round-cap + optional meal free-allowance check, then upsert/delete.
-- Meal formula matches checkSushiLimitForCartLine(staffAssisted:=false):
--   already = session_ordered + other round lines for same menu_item
--   reject when already + next_qty > per_person_meal_limit * live_guest_count

CREATE OR REPLACE FUNCTION public.upsert_table_order_round_line(
  p_restaurant_id uuid,
  p_session_id uuid,
  p_table_id uuid,
  p_guest_client_id uuid,
  p_menu_item_id uuid,
  p_qty integer,
  p_note text,
  p_qty_mode text,
  p_live_guest_count integer,
  p_per_person_round_cap integer,
  p_session_ordered_qty integer,
  p_apply_meal_limit boolean,
  p_per_person_meal_limit integer DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
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

  PERFORM pg_advisory_xact_lock(hashtext(p_session_id::text));

  SELECT *
  INTO v_round
  FROM public.table_order_rounds
  WHERE session_id = p_session_id
    AND status IN ('collecting', 'pending_confirm', 'cooldown', 'finalize_failed')
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    IF v_round.status = 'cooldown'
       AND v_round.cooldown_until IS NOT NULL
       AND v_round.cooldown_until > v_now THEN
      RETURN jsonb_build_object('ok', false, 'error', 'round_cooldown_active');
    END IF;
    IF v_round.status = 'cooldown'
       AND (v_round.cooldown_until IS NULL OR v_round.cooldown_until <= v_now) THEN
      UPDATE public.table_order_rounds
      SET status = 'closed', updated_at = v_now
      WHERE id = v_round.id
        AND status = 'cooldown';
      v_use_round := false;
    ELSIF v_round.status = 'finalize_failed' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'round_basket_locked');
    ELSIF v_round.status IN ('collecting', 'pending_confirm') THEN
      v_use_round := true;
    ELSE
      RETURN jsonb_build_object('ok', false, 'error', 'round_not_collecting');
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

CREATE OR REPLACE FUNCTION public.delete_table_order_round_line(
  p_session_id uuid,
  p_guest_client_id uuid,
  p_line_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
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

REVOKE ALL ON FUNCTION public.upsert_table_order_round_line(
  uuid, uuid, uuid, uuid, uuid, integer, text, text, integer, integer, integer, boolean, integer
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_table_order_round_line(
  uuid, uuid, uuid, uuid, uuid, integer, text, text, integer, integer, integer, boolean, integer
) TO service_role;

REVOKE ALL ON FUNCTION public.delete_table_order_round_line(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_table_order_round_line(uuid, uuid, uuid) TO service_role;

COMMENT ON FUNCTION public.upsert_table_order_round_line IS
  'Sole guest round-line upsert: session advisory lock + round FOR UPDATE; round cap + optional meal free cap.';
COMMENT ON FUNCTION public.delete_table_order_round_line IS
  'Sole guest round-line delete under the same session advisory lock as upsert.';
