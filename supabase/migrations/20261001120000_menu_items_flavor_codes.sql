-- Dish inherent flavor display hints (guest chips only).
-- App validates codes; not guest note presets / allergens / print.

ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS flavor_codes text[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN public.menu_items.flavor_codes IS
  'Display-only flavor hint codes (spice_mild|medium|extra, numb_*, sour, sweet, sweet_sour, light, heavy, umami, aroma_*). Empty = none shown. Gated by menu_flavor_hints_enabled.';

CREATE INDEX IF NOT EXISTS idx_menu_items_flavor_codes
  ON public.menu_items USING gin (flavor_codes);
