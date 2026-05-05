-- Allow custom and nested category paths (e.g. "Pratos / Peixe / Bacalhau").
alter table public.menu_items
  drop constraint if exists menu_items_category_check;
