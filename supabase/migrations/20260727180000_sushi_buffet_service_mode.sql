-- Sushi buffet: restaurant service mode + per-person menu limits with overage price.

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS buffet_service_mode text NOT NULL DEFAULT 'classic';

ALTER TABLE public.restaurants
  DROP CONSTRAINT IF EXISTS restaurants_buffet_service_mode_check;

ALTER TABLE public.restaurants
  ADD CONSTRAINT restaurants_buffet_service_mode_check
  CHECK (buffet_service_mode IN ('classic', 'sushi'));

COMMENT ON COLUMN public.restaurants.buffet_service_mode IS
  'classic = unlimited menu items after open; sushi = optional per-person qty limits with overage pricing';

ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS per_person_qty_limit integer NULL;

ALTER TABLE public.menu_items
  DROP CONSTRAINT IF EXISTS menu_items_per_person_qty_limit_check;

ALTER TABLE public.menu_items
  ADD CONSTRAINT menu_items_per_person_qty_limit_check
  CHECK (per_person_qty_limit IS NULL OR per_person_qty_limit >= 1);

ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS over_limit_unit_price numeric NULL;

ALTER TABLE public.menu_items
  DROP CONSTRAINT IF EXISTS menu_items_over_limit_unit_price_check;

ALTER TABLE public.menu_items
  ADD CONSTRAINT menu_items_over_limit_unit_price_check
  CHECK (over_limit_unit_price IS NULL OR over_limit_unit_price >= 0);

ALTER TABLE public.menu_items
  DROP CONSTRAINT IF EXISTS menu_items_limit_requires_overage_price;

ALTER TABLE public.menu_items
  ADD CONSTRAINT menu_items_limit_requires_overage_price
  CHECK (
    (per_person_qty_limit IS NULL AND over_limit_unit_price IS NULL)
    OR (per_person_qty_limit IS NOT NULL AND over_limit_unit_price IS NOT NULL)
  );

COMMENT ON COLUMN public.menu_items.per_person_qty_limit IS
  'When restaurant is sushi mode: max included portions per guest (adult+child). NULL = unlimited.';

COMMENT ON COLUMN public.menu_items.over_limit_unit_price IS
  'Unit price for portions beyond free allowance; required when per_person_qty_limit is set.';
