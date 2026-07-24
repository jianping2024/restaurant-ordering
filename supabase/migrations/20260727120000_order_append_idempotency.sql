-- Guest/waiter order append idempotency: one client_request_id per session intent.

create table public.order_append_idempotency (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  session_id uuid not null references public.table_sessions (id) on delete cascade,
  client_request_id uuid not null,
  status text not null check (status in ('pending', 'completed')),
  order_id uuid references public.orders (id) on delete set null,
  batch_id text,
  had_done_before boolean,
  is_first_order boolean,
  line_count integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, client_request_id)
);

create index idx_order_append_idempotency_restaurant_created
  on public.order_append_idempotency (restaurant_id, created_at desc);

comment on table public.order_append_idempotency is
  'Append intent dedupe: UNIQUE(session_id, client_request_id); completed rows store replay fields (token re-signed on read).';

alter table public.order_append_idempotency enable row level security;
-- No policies: only service_role (admin client) reads/writes; anon/authenticated denied.
