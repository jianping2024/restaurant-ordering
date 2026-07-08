-- Operation audit log + session payment gap + manual close (owner/frontdesk) with audit snapshot.

CREATE TABLE public.operation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants (id) ON DELETE CASCADE,
  action_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  operator_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  operator_name text NOT NULL,
  operator_role text NOT NULL,
  before_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  after_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text,
  reason_detail text,
  ip_address text,
  device_info text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_operation_logs_restaurant_created
  ON public.operation_logs (restaurant_id, created_at DESC);
ALTER TABLE public.operation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.abnormal_operations
  ADD COLUMN IF NOT EXISTS source_action_id uuid REFERENCES public.operation_logs (id) ON DELETE SET NULL;
CREATE OR REPLACE FUNCTION public.compute_session_payment_gap(
  p_restaurant_id uuid,
  p_session_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_payable numeric := 0;
  v_paid numeric := 0;
  v_has_unpaid_split boolean := false;
  v_gap numeric;
  v_order record;
  v_split record;
  v_row jsonb;
BEGIN
  FOR v_order IN
    SELECT items
    FROM public.orders
    WHERE restaurant_id = p_restaurant_id
      AND session_id = p_session_id
  LOOP
    v_payable := v_payable + public.recalc_order_total_from_items(v_order.items);
  END LOOP;

  FOR v_split IN
    SELECT result, status
    FROM public.bill_splits
    WHERE restaurant_id = p_restaurant_id
      AND session_id = p_session_id
  LOOP
    IF v_split.status IN ('pending', 'confirmed', 'requested') THEN
      v_has_unpaid_split := true;
    END IF;
    IF v_split.result IS NOT NULL THEN
      FOR v_row IN
        SELECT value
        FROM jsonb_array_elements(v_split.result) AS t(value)
      LOOP
        IF coalesce((v_row->>'paid')::boolean, false) THEN
          v_paid := v_paid + coalesce((v_row->>'amount')::numeric, 0);
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  v_gap := greatest(v_payable - v_paid, 0);

  RETURN jsonb_build_object(
    'payable_amount', v_payable,
    'paid_amount', v_paid,
    'gap', v_gap,
    'has_unpaid_split', v_has_unpaid_split,
    'is_unpaid_close', v_has_unpaid_split OR v_gap > 0.0001
  );
END;
$$;
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
      AND a.role = 'frontdesk'
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
REVOKE ALL ON FUNCTION public.compute_session_payment_gap(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compute_session_payment_gap(uuid, uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.close_table_session_manual(
  uuid, uuid, uuid, text, boolean, text, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_table_session_manual(
  uuid, uuid, uuid, text, boolean, text, text
) TO authenticated, service_role;
