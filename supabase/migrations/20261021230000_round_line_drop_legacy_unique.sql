-- Sole round-line identity: UNIQUE (round_id, menu_item_id, guest_client_id, note).
-- 20260930172000 tried to drop the legacy (round_id, menu_item_id, guest_client_id) UNIQUE by its
-- 65-char spelled name, but Postgres had auto-named it truncated (`..._guest_client__key`), so the
-- IF EXISTS drop no-op'd. The legacy key then rejects a noted line beside a no-note line of the same
-- dish (23505 → line_update_failed). Drop it by column set, not by name.

DO $$
DECLARE
  v_conname text;
BEGIN
  FOR v_conname IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'public.table_order_round_lines'::regclass
      AND c.contype = 'u'
      AND (
        SELECT array_agg(a.attname::text ORDER BY a.attname)
        FROM unnest(c.conkey) AS k(attnum)
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
      ) = ARRAY['guest_client_id', 'menu_item_id', 'round_id']
  LOOP
    EXECUTE format('ALTER TABLE public.table_order_round_lines DROP CONSTRAINT %I', v_conname);
  END LOOP;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_table_order_round_lines_round_item_guest_note
  ON public.table_order_round_lines (round_id, menu_item_id, guest_client_id, note);
