-- Dish vegetarian flag + Chinese description; sushi-only dietary filter toggles (default off).

ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS is_vegetarian boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.menu_items.is_vegetarian IS
  'Owner-marked vegetarian dish. false = not marked vegetarian (default).';

ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS description_zh text;

COMMENT ON COLUMN public.menu_items.description_zh IS
  'Optional Chinese dish description; guest UI prefers this when lang=zh.';

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS sushi_menu_vegetarian_filter_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS sushi_menu_allergen_filter_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.restaurants.sushi_menu_vegetarian_filter_enabled IS
  'When true and buffet_service_mode=sushi, guest sushi menu shows vegetarian lamp filter. Default false.';

COMMENT ON COLUMN public.restaurants.sushi_menu_allergen_filter_enabled IS
  'When true and buffet_service_mode=sushi, guest sushi menu shows allergen-avoid filter. Default false.';
