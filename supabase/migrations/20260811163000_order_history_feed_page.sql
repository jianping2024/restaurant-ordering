-- Order history list: one SQL union feed (closed sessions + transfer-out events)
-- with DB sort/offset/limit. App hydrates orders only for the page's closed ids.

CREATE OR REPLACE FUNCTION public.order_history_feed_page(
  p_restaurant_id uuid,
  p_closed_from timestamptz DEFAULT NULL,
  p_closed_to timestamptz DEFAULT NULL,
  p_table_ids uuid[] DEFAULT NULL,
  p_session_id uuid DEFAULT NULL,
  p_include_transfers boolean DEFAULT true,
  p_offset integer DEFAULT 0,
  p_limit integer DEFAULT 10
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
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

REVOKE ALL ON FUNCTION public.order_history_feed_page(
  uuid, timestamptz, timestamptz, uuid[], uuid, boolean, integer, integer
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.order_history_feed_page(
  uuid, timestamptz, timestamptz, uuid[], uuid, boolean, integer, integer
) TO service_role;

COMMENT ON FUNCTION public.order_history_feed_page(
  uuid, timestamptz, timestamptz, uuid[], uuid, boolean, integer, integer
) IS 'Dashboard order-history merged feed (closed + transfer-out) with DB pagination; service_role only.';
