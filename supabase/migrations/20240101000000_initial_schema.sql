-- 启用 UUID 扩展
create extension if not exists "uuid-ossp";

-- ============================================================
-- restaurants 表（租户表）
-- ============================================================
create table public.restaurants (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  slug        text not null unique,           -- 用于子路径，如 /casa-portuguesa/menu
  owner_id    uuid not null references auth.users(id) on delete cascade,
  logo_url    text,
  address     text,
  phone       text,
  plan        text not null default 'free' check (plan in ('free', 'pro')),
  kitchen_password text not null default '1234',  -- 厨房访问密码
  created_at  timestamptz not null default now()
);

-- ============================================================
-- menu_items 表
-- ============================================================
create table public.menu_items (
  id              uuid primary key default uuid_generate_v4(),
  restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
  name_pt         text not null,              -- 葡萄牙语名称
  name_en         text,                       -- 英语名称
  name_zh         text,                       -- 中文名称
  description_pt  text,                       -- 葡语描述
  description_en  text,                       -- 英语描述
  price           numeric(10,2) not null,
  category        text not null check (category in ('Entradas','Pratos','Bebidas','Sobremesas')),
  emoji           text not null default '🍽️',
  available       boolean not null default true,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now()
);

-- ============================================================
-- orders 表
-- ============================================================
create table public.orders (
  id              uuid primary key default uuid_generate_v4(),
  restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
  table_number    integer not null,
  status          text not null default 'pending' check (status in ('pending','cooking','done')),
  items           jsonb not null default '[]',  -- [{name,qty,note,price,emoji}]
  total_amount    numeric(10,2) not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- orders 更新时自动刷新 updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger orders_updated_at
  before update on public.orders
  for each row execute function public.handle_updated_at();

-- ============================================================
-- bill_splits 表
-- ============================================================
create table public.bill_splits (
  id              uuid primary key default uuid_generate_v4(),
  restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
  table_number    integer not null,
  order_ids       uuid[] not null default '{}',
  split_mode      text not null check (split_mode in ('even','by_item','custom')),
  persons         jsonb not null default '[]',  -- [{name, items?}]
  result          jsonb not null default '[]',  -- [{name, amount, items?}]
  total_amount    numeric(10,2) not null default 0,
  status          text not null default 'pending' check (status in ('pending','confirmed')),
  created_at      timestamptz not null default now()
);

-- ============================================================
-- 索引
-- ============================================================
create index idx_menu_items_restaurant on public.menu_items(restaurant_id);
create index idx_menu_items_category on public.menu_items(restaurant_id, category);
create index idx_orders_restaurant on public.orders(restaurant_id);
create index idx_orders_table on public.orders(restaurant_id, table_number);
create index idx_orders_status on public.orders(restaurant_id, status);
create index idx_bill_splits_restaurant on public.bill_splits(restaurant_id);

-- ============================================================
-- RLS（行级安全策略）
-- ============================================================

-- restaurants 表：owner 管理自己的餐厅
alter table public.restaurants enable row level security;

create policy "restaurants_select_own"
  on public.restaurants for select
  using (owner_id = auth.uid());

create policy "restaurants_insert_own"
  on public.restaurants for insert
  with check (owner_id = auth.uid());

create policy "restaurants_update_own"
  on public.restaurants for update
  using (owner_id = auth.uid());

create policy "restaurants_delete_own"
  on public.restaurants for delete
  using (owner_id = auth.uid());

-- 允许公开读取餐厅基本信息（顾客通过 slug 查看菜单）
create policy "restaurants_public_read_by_slug"
  on public.restaurants for select
  using (true);

-- menu_items 表
alter table public.menu_items enable row level security;

-- 所有人可以读取菜单（顾客点餐）
create policy "menu_items_public_read"
  on public.menu_items for select
  using (true);

-- 只有餐厅 owner 可以修改菜单
create policy "menu_items_owner_all"
  on public.menu_items for all
  using (
    restaurant_id in (
      select id from public.restaurants where owner_id = auth.uid()
    )
  );

-- orders 表
alter table public.orders enable row level security;

-- 所有人可以插入订单（顾客提交）和读取（厨房、账单页）
create policy "orders_public_insert"
  on public.orders for insert
  with check (true);

create policy "orders_public_read"
  on public.orders for select
  using (true);

-- 只有 owner 可以更新订单状态
create policy "orders_owner_update"
  on public.orders for update
  using (
    restaurant_id in (
      select id from public.restaurants where owner_id = auth.uid()
    )
  );

-- 厨房页通过 restaurant_id 匹配来更新状态（无需登录）
create policy "orders_kitchen_update"
  on public.orders for update
  using (true);

-- bill_splits 表
alter table public.bill_splits enable row level security;

create policy "bill_splits_public_all"
  on public.bill_splits for all
  using (true)
  with check (true);

-- ============================================================
-- Realtime：允许 orders 表订阅
-- ============================================================
alter publication supabase_realtime add table public.orders;
