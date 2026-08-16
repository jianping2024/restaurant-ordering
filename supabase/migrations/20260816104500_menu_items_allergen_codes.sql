-- Dish "contains" allergen declaration (EU Reg. 1169/2011 Annex II codes).
-- App validates codes; DB stores text[] (NOT guest note_preset_keys).

ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS allergen_codes text[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN public.menu_items.allergen_codes IS
  'EU allergen codes this dish is known to contain (egg, milk, soy, gluten, peanut, sulphites, fish, molluscs, mustard, tree_nuts, sesame, celery, lupin, crustaceans). Empty = unmarked, not allergen-free.';

CREATE INDEX IF NOT EXISTS idx_menu_items_allergen_codes
  ON public.menu_items USING gin (allergen_codes);
