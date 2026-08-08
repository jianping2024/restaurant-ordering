-- Collapse retired permission keys into sole live keys on restaurant_roles.permissions.
-- buffet.post_to_table → tables.open_session (开台 / 保存人数)
-- floor.waiter_board.view → dashboard.waiter_board.view (sole 楼面看板; /{slug}/waiter removed)

UPDATE public.restaurant_roles
SET permissions = (
  SELECT COALESCE(jsonb_agg(to_jsonb(mapped) ORDER BY mapped), '[]'::jsonb)
  FROM (
    SELECT DISTINCT
      CASE elem
        WHEN 'buffet.post_to_table' THEN 'tables.open_session'
        WHEN 'floor.waiter_board.view' THEN 'dashboard.waiter_board.view'
        ELSE elem
      END AS mapped
    FROM jsonb_array_elements_text(permissions) AS t(elem)
  ) d
)
WHERE EXISTS (
  SELECT 1
  FROM jsonb_array_elements_text(permissions) AS t(elem)
  WHERE elem IN ('buffet.post_to_table', 'floor.waiter_board.view')
);
