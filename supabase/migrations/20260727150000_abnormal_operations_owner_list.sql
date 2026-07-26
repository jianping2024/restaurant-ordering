-- Abnormal ops owner list: one round-trip page + stats (DB sort/pagination).
-- Replaces app-layer select(*) + in-memory sort/slice for /api/dashboard/abnormal-operations.

CREATE OR REPLACE FUNCTION public.abnormal_operations_owner_list(
  p_restaurant_id uuid,
  p_start_utc timestamptz,
  p_end_exclusive_utc timestamptz,
  p_type text DEFAULT NULL,
  p_risk_level text DEFAULT NULL,
  p_operator_id uuid DEFAULT NULL,
  p_table_id uuid DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 20
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
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
  page_rows AS (
    SELECT to_jsonb(f) AS row_json
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
  ),
  page AS (
    SELECT coalesce(jsonb_agg(row_json), '[]'::jsonb) AS items
    FROM page_rows
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

REVOKE ALL ON FUNCTION public.abnormal_operations_owner_list(
  uuid, timestamptz, timestamptz, text, text, uuid, uuid, text, integer, integer
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.abnormal_operations_owner_list(
  uuid, timestamptz, timestamptz, text, text, uuid, uuid, text, integer, integer
) TO service_role;
