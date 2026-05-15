-- P0 security: hide staff passwords from anon reads; remove world-writable order updates.

-- Public restaurant profile (no kitchen_password / waiter_password).
create or replace view public.restaurants_public
with (security_invoker = true) as
  select
    id,
    name,
    slug,
    logo_url,
    address,
    phone,
    plan,
    geo_latitude,
    geo_longitude,
    print_locale,
    created_at
  from public.restaurants;

grant select on public.restaurants_public to anon, authenticated;

drop policy if exists "restaurants_public_read_by_slug" on public.restaurants;

-- Orders: drop anonymous kitchen-wide update; reads limited to active sessions.
drop policy if exists "orders_kitchen_update" on public.orders;
drop policy if exists "orders_public_read" on public.orders;

create policy "orders_select_active_session"
  on public.orders for select
  using (
    session_id is not null
    and exists (
      select 1
      from public.table_sessions ts
      where ts.id = orders.session_id
        and ts.status in ('open', 'billing')
    )
  );

create policy "orders_update_active_session"
  on public.orders for update
  using (
    session_id is not null
    and exists (
      select 1
      from public.table_sessions ts
      where ts.id = orders.session_id
        and ts.status in ('open', 'billing')
    )
  )
  with check (
    session_id is not null
    and exists (
      select 1
      from public.table_sessions ts
      where ts.id = orders.session_id
        and ts.status in ('open', 'billing')
    )
  );

-- Table sessions: no anonymous update/delete; reads for ordering + merge redirect.
drop policy if exists "table_sessions_public_all" on public.table_sessions;

create policy "table_sessions_select_public"
  on public.table_sessions for select
  using (
    status in ('open', 'billing')
    or (
      status = 'closed'
      and closed_reason = 'merged'
      and merge_into_session_id is not null
    )
  );

create policy "table_sessions_insert_public"
  on public.table_sessions for insert
  with check (true);

-- Guests: open → billing; billing → closed after bill paid. Staff close via API (service role).
create policy "table_sessions_update_guest_flow"
  on public.table_sessions for update
  using (status in ('open', 'billing'))
  with check (status in ('open', 'billing', 'closed'));

-- Bill splits: session-scoped read/write for guests; no global anon update.
drop policy if exists "bill_splits_public_all" on public.bill_splits;

create policy "bill_splits_select_session"
  on public.bill_splits for select
  using (
    session_id is not null
    and exists (
      select 1
      from public.table_sessions ts
      where ts.id = bill_splits.session_id
    )
  );

create policy "bill_splits_insert_session"
  on public.bill_splits for insert
  with check (
    session_id is not null
    and exists (
      select 1
      from public.table_sessions ts
      where ts.id = bill_splits.session_id
        and ts.status in ('open', 'billing')
    )
  );

create policy "bill_splits_update_session"
  on public.bill_splits for update
  using (
    session_id is not null
    and exists (
      select 1
      from public.table_sessions ts
      where ts.id = bill_splits.session_id
        and ts.status in ('open', 'billing', 'closed')
    )
  )
  with check (
    session_id is not null
    and exists (
      select 1
      from public.table_sessions ts
      where ts.id = bill_splits.session_id
    )
  );
