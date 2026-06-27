-- Renumber menu_items.sort_order to 0..n-1 within each (restaurant_id, category_id) scope.
-- Enforce uniqueness so adjacent swap reorder stays a simple exchange.

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY restaurant_id, category_id
      ORDER BY sort_order ASC, created_at ASC
    ) - 1 AS new_sort_order
  FROM public.menu_items
)
UPDATE public.menu_items AS m
SET sort_order = r.new_sort_order
FROM ranked AS r
WHERE m.id = r.id
  AND m.sort_order IS DISTINCT FROM r.new_sort_order;

CREATE UNIQUE INDEX IF NOT EXISTS idx_menu_items_category_sort_order
  ON public.menu_items (restaurant_id, category_id, sort_order)
  WHERE category_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_menu_items_uncategorized_sort_order
  ON public.menu_items (restaurant_id, sort_order)
  WHERE category_id IS NULL;
