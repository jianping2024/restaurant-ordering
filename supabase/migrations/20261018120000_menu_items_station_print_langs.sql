-- Station slip multilang names: per-dish flags for which names print on station_ticket.
-- docs/product/station-slip-multilang-names.zh.md §3

alter table public.menu_items
  add column if not exists station_print_pt boolean not null default true,
  add column if not exists station_print_en boolean not null default false,
  add column if not exists station_print_zh boolean not null default false;
