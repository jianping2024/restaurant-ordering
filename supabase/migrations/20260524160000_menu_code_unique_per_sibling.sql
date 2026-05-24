-- Unique category codes among siblings; unique dish codes per restaurant (non-empty only).

create unique index if not exists idx_menu_categories_code_per_parent
  on public.menu_categories (
    restaurant_id,
    (coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid)),
    lower(btrim(item_code))
  )
  where item_code is not null and btrim(item_code) <> '';

create unique index if not exists idx_menu_items_code_per_restaurant
  on public.menu_items (restaurant_id, lower(btrim(item_code)))
  where item_code is not null and btrim(item_code) <> '';
