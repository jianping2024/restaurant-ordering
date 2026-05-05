create extension if not exists pgcrypto;

create table if not exists public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  parent_id uuid references public.menu_categories(id) on delete cascade,
  name_pt text not null,
  name_en text,
  name_zh text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_menu_categories_restaurant
  on public.menu_categories(restaurant_id, parent_id, sort_order);

alter table public.menu_categories enable row level security;

create policy "menu_categories_public_read"
  on public.menu_categories for select
  using (true);

create policy "menu_categories_owner_all"
  on public.menu_categories for all
  using (
    restaurant_id in (
      select id from public.restaurants where owner_id = auth.uid()
    )
  );

alter table public.menu_items
  add column if not exists category_id uuid references public.menu_categories(id) on delete set null;

create index if not exists idx_menu_items_category_id
  on public.menu_items(restaurant_id, category_id);
