-- ============================================================
-- Configurable note presets for menu items
-- ============================================================

alter table public.menu_items
  add column if not exists note_preset_keys text[] not null default '{}';

create index if not exists idx_menu_items_note_preset_keys
  on public.menu_items using gin (note_preset_keys);
