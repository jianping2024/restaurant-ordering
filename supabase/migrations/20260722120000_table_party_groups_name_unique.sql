-- Same restaurant: party display names unique (case-insensitive, trim).

DO $$
DECLARE
  r RECORD;
  candidate text;
  n int;
  suffix text;
BEGIN
  FOR r IN
    SELECT t.id, t.restaurant_id, btrim(t.name) AS base_name
    FROM public.table_party_groups t
    WHERE EXISTS (
      SELECT 1
      FROM public.table_party_groups o
      WHERE o.restaurant_id = t.restaurant_id
        AND o.id <> t.id
        AND lower(btrim(o.name)) = lower(btrim(t.name))
        AND (
          o.created_at < t.created_at
          OR (o.created_at = t.created_at AND o.id < t.id)
        )
    )
    ORDER BY t.restaurant_id, t.created_at, t.id
  LOOP
    n := 2;
    LOOP
      suffix := ' ' || n::text;
      candidate := left(r.base_name, greatest(1, 32 - char_length(suffix))) || suffix;
      EXIT WHEN NOT EXISTS (
        SELECT 1
        FROM public.table_party_groups g
        WHERE g.restaurant_id = r.restaurant_id
          AND lower(btrim(g.name)) = lower(btrim(candidate))
      );
      n := n + 1;
    END LOOP;
    UPDATE public.table_party_groups
    SET name = candidate
    WHERE id = r.id;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS table_party_groups_restaurant_name_unique
  ON public.table_party_groups (restaurant_id, lower(btrim(name)));
