-- Add localized category path fields for multilingual menu category tabs.
alter table public.menu_items
  add column if not exists category_en text,
  add column if not exists category_zh text;
