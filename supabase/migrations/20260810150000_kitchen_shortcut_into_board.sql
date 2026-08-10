-- Collapse kitchen top-nav shortcut into sole kitchen board capability.
-- dashboard.kitchen_shortcut.view → floor.kitchen_board.view
-- (enter /{slug}/kitchen and staff top-bar kitchen entry share one permission)

UPDATE public.restaurant_roles
SET permissions = (
  SELECT COALESCE(jsonb_agg(to_jsonb(mapped) ORDER BY mapped), '[]'::jsonb)
  FROM (
    SELECT DISTINCT
      CASE elem
        WHEN 'dashboard.kitchen_shortcut.view' THEN 'floor.kitchen_board.view'
        ELSE elem
      END AS mapped
    FROM jsonb_array_elements_text(permissions) AS t(elem)
  ) d
)
WHERE EXISTS (
  SELECT 1
  FROM jsonb_array_elements_text(permissions) AS t(elem)
  WHERE elem = 'dashboard.kitchen_shortcut.view'
);
