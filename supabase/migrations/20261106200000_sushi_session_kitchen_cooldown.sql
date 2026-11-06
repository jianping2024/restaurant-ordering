-- Table kitchen cooldown moves off the active round slot onto the session.
-- Guests may collect the next free-dish basket during cooldown; only submit/finalize stay gated.
-- Legacy active `cooldown` rounds are closed and their until is copied onto the session when needed.

ALTER TABLE public.table_sessions
  ADD COLUMN IF NOT EXISTS sushi_round_cooldown_until timestamptz;

COMMENT ON COLUMN public.table_sessions.sushi_round_cooldown_until IS
  'Sushi table kitchen-send cooldown end; null = not cooling. Blocks submit/finalize only — not free-dish basket writes.';

-- Backfill from any still-active cooldown rounds so open tables keep their remaining wait.
UPDATE public.table_sessions s
SET sushi_round_cooldown_until = r.cooldown_until
FROM public.table_order_rounds r
WHERE r.session_id = s.id
  AND r.status = 'cooldown'
  AND r.cooldown_until IS NOT NULL
  AND r.cooldown_until > now()
  AND (
    s.sushi_round_cooldown_until IS NULL
    OR s.sushi_round_cooldown_until < r.cooldown_until
  );

CREATE OR REPLACE FUNCTION public.settle_expired_table_order_round_cooldown(
  p_session_id uuid
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_round public.table_order_rounds%ROWTYPE;
  v_session_until timestamptz;
  v_now timestamptz := now();
  v_closed boolean := false;
  v_active boolean := false;
BEGIN
  IF p_session_id IS NULL THEN
    RETURN 'noop';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_session_id::text));

  SELECT sushi_round_cooldown_until
  INTO v_session_until
  FROM public.table_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'noop';
  END IF;

  -- Clear expired session clock.
  IF v_session_until IS NOT NULL AND v_session_until <= v_now THEN
    UPDATE public.table_sessions
    SET sushi_round_cooldown_until = NULL
    WHERE id = p_session_id;
    v_session_until := NULL;
  END IF;

  -- Legacy: free the active slot by closing any cooldown round; keep remaining wait on session.
  SELECT *
  INTO v_round
  FROM public.table_order_rounds
  WHERE session_id = p_session_id
    AND status = 'cooldown'
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    IF v_round.cooldown_until IS NOT NULL
       AND v_round.cooldown_until > v_now
       AND (v_session_until IS NULL OR v_session_until < v_round.cooldown_until) THEN
      UPDATE public.table_sessions
      SET sushi_round_cooldown_until = v_round.cooldown_until
      WHERE id = p_session_id;
      v_session_until := v_round.cooldown_until;
    END IF;

    UPDATE public.table_order_rounds
    SET status = 'closed', updated_at = v_now
    WHERE id = v_round.id
      AND status = 'cooldown';
    v_closed := true;
  END IF;

  IF v_session_until IS NOT NULL AND v_session_until > v_now THEN
    v_active := true;
  END IF;

  IF v_active THEN
    RETURN 'cooldown_active';
  END IF;
  IF v_closed THEN
    RETURN 'closed';
  END IF;
  RETURN 'noop';
END;
$$;

COMMENT ON FUNCTION public.settle_expired_table_order_round_cooldown(uuid) IS
  'Sole kitchen-cooldown settle: clear expired session clock; close legacy cooldown rounds (copy until onto session); returns cooldown_active|closed|noop. Does not block basket writes.';

-- Upsert: settle frees legacy cooldown slots; session clock does NOT block writing the next basket.
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

  -- Settle may return cooldown_active (session clock still running) — writes still allowed.
  PERFORM public.settle_expired_table_order_round_cooldown(p_session_id);

  SELECT *
  INTO v_round
  FROM public.table_order_rounds
  WHERE session_id = p_session_id
    AND status IN ('collecting', 'pending_confirm', 'finalize_failed')
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    IF v_round.status = 'finalize_failed' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'round_basket_locked');
    ELSIF v_round.status IN ('collecting', 'pending_confirm') THEN
      v_use_round := true;
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

COMMENT ON FUNCTION public.upsert_table_order_round_line IS
  'Sole guest round-line upsert: settle session kitchen cooldown (does not block write) + session lock + FOR UPDATE; round cap + optional meal free cap.';
