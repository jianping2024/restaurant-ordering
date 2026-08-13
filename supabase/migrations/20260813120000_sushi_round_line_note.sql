-- Round lines carry the same guest note as classic cart; finalize groups by (item, note).

ALTER TABLE public.table_order_round_lines
  ADD COLUMN IF NOT EXISTS note text NOT NULL DEFAULT '';

ALTER TABLE public.table_order_round_lines
  DROP CONSTRAINT IF EXISTS table_order_round_lines_note_len;

ALTER TABLE public.table_order_round_lines
  ADD CONSTRAINT table_order_round_lines_note_len
  CHECK (char_length(note) <= 120);

COMMENT ON COLUMN public.table_order_round_lines.note IS
  'Guest cart note on this client+item line; empty string when none.';
