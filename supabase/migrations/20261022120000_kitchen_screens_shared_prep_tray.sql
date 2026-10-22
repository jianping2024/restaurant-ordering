-- Per-screen layout flag: one prep tray shared by every station on the screen (right column)
-- instead of one tray inside each station pane. Default off keeps existing screens unchanged.

ALTER TABLE public.kitchen_screens
  ADD COLUMN IF NOT EXISTS shared_prep_tray boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.kitchen_screens.shared_prep_tray IS
  'When true: the kitchen screen shows one prep tray for all its stations; prep still posts per station.';
