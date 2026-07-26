-- One-RTT closed-session revenue raw materials for dashboard overview (Lisbon window passed from app).
-- Business qualifying / forced-close merge stays in TypeScript (todayRevenueFromBundle).

CREATE INDEX IF NOT EXISTS idx_abnormal_operations_restaurant_unpaid_session
  ON public.abnormal_operations (restaurant_id, session_id)
  WHERE type = 'UNPAID_TABLE_CLOSED' AND session_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.dashboard_overview_revenue_bundle(
  p_restaurant_id uuid,
  p_start_utc timestamptz,
  p_end_exclusive_utc timestamptz,
  p_max_sessions integer DEFAULT 2000
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public
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

REVOKE ALL ON FUNCTION public.dashboard_overview_revenue_bundle(
  uuid, timestamptz, timestamptz, integer
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.dashboard_overview_revenue_bundle(
  uuid, timestamptz, timestamptz, integer
) TO service_role;
