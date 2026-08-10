-- Client menu catalog freshness: bump on dashboard menu mutations; clients compare before full fetch.
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS menu_catalog_version integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.restaurants.menu_catalog_version IS
  'Monotonic counter bumped when customer-facing menu catalog changes (items/categories/availability). Clients compare before re-fetching the full catalog.';
