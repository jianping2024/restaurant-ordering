-- Per-dish VAT (IVA) rate for billing and fiscal reporting.
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS vat_rate numeric(5, 2) NOT NULL DEFAULT 23;

ALTER TABLE public.menu_items
  ADD CONSTRAINT menu_items_vat_rate_range
  CHECK (vat_rate >= 0 AND vat_rate <= 100);

COMMENT ON COLUMN public.menu_items.vat_rate IS 'VAT / IVA rate in percent (e.g. 23 for 23%). Required per dish.';
