-- Allow cashier staff to manually close table sessions (same as frontdesk).

CREATE OR REPLACE FUNCTION public.close_table_session_manual(
  p_restaurant_id uuid,
  p_table_id uuid,
  p_operator_user_id uuid,
  p_closed_reason text,
  p_confirm_close boolean,
  p_unpaid_reason text DEFAULT NULL,
  p_unpaid_reason_detail text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
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
      AND a.role IN ('frontdesk', 'cashier')
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
