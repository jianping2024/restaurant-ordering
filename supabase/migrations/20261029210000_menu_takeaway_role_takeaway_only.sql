-- Allow takeaway-only dishes (takeaway menu, not dine-in). Extends takeaway_role enum.

alter table public.menu_items
  drop constraint if exists menu_items_takeaway_role_check;

alter table public.menu_items
  add constraint menu_items_takeaway_role_check
  check (takeaway_role in ('none', 'sellable', 'takeaway_only', 'packaging'));

alter table public.menu_items
  drop constraint if exists menu_items_takeaway_price_when_sellable;

alter table public.menu_items
  add constraint menu_items_takeaway_price_when_takeaway_menu
  check (
    takeaway_role not in ('sellable', 'takeaway_only')
    or (takeaway_price is not null and takeaway_price > 0)
  );

comment on column public.menu_items.takeaway_role is
  'none=dine-in only; sellable=dine-in+takeaway; takeaway_only=takeaway menu only; packaging=checkout supply only.';

comment on column public.menu_items.takeaway_price is
  'Unit price when takeaway_role is sellable or takeaway_only; ignored otherwise.';
