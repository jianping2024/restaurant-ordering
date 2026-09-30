-- Round free lines: same dish + same guest + same note merges; different notes are separate rows.
-- Aligns UNIQUE with aggregateRoundLinesForAppend / kitchen append (menu_item_id, note).

ALTER TABLE public.table_order_round_lines
  DROP CONSTRAINT IF EXISTS table_order_round_lines_round_id_menu_item_id_guest_client_id_key;

DROP INDEX IF EXISTS public.table_order_round_lines_round_id_menu_item_id_guest_client_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_table_order_round_lines_round_item_guest_note
  ON public.table_order_round_lines (round_id, menu_item_id, guest_client_id, note);

COMMENT ON INDEX public.uniq_table_order_round_lines_round_item_guest_note IS
  'One round line per (item, guest, note); different notes stay separate rows.';
