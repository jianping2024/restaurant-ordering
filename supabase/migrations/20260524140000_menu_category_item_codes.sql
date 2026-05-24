-- Manual codes for thermal tickets: nested category path + dish code prefix.

alter table public.menu_categories
  add column if not exists item_code varchar(10);

alter table public.menu_items
  add column if not exists item_code varchar(10);

comment on column public.menu_categories.item_code is 'Optional category code (max 10), printed on tickets before dish code.';
comment on column public.menu_items.item_code is 'Optional dish code (max 10), printed on tickets after category path.';
