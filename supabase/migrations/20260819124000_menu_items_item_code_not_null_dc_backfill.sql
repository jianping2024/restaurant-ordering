-- Ensure menu_items.item_code is always non-empty.
-- Backfill legacy NULL/blank values with `DC{n}` per restaurant, where `n` is auto-incremented.
BEGIN;

-- 1) Backfill missing codes (NULL or only-whitespace).
WITH missing AS (
  SELECT
    id,
    restaurant_id,
    row_number() OVER (PARTITION BY restaurant_id ORDER BY created_at ASC, id ASC) AS rn
  FROM public.menu_items
  WHERE item_code IS NULL OR btrim(item_code) = ''
),
maxes AS (
  SELECT
    restaurant_id,
    COALESCE(
      MAX(
        CASE
          WHEN btrim(item_code) ~ '^DC[0-9]+$'
          THEN CAST(substring(btrim(item_code) from '^DC([0-9]+)$') AS integer)
        END
      ),
      0
    ) AS max_n
  FROM public.menu_items
  WHERE restaurant_id IN (SELECT restaurant_id FROM missing)
  GROUP BY restaurant_id
)
UPDATE public.menu_items m
SET item_code = 'DC' || (maxes.max_n + missing.rn)
FROM missing
JOIN maxes ON maxes.restaurant_id = missing.restaurant_id
WHERE m.id = missing.id;

-- 2) Enforce NOT NULL + not blank + max length.
ALTER TABLE public.menu_items
  ALTER COLUMN item_code SET NOT NULL;

ALTER TABLE public.menu_items
  ADD CONSTRAINT menu_items_item_code_not_blank
  CHECK (btrim(item_code) <> ''::text);

ALTER TABLE public.menu_items
  ADD CONSTRAINT menu_items_item_code_max_len_10
  CHECK (char_length(btrim(item_code)) <= 10);

COMMIT;

