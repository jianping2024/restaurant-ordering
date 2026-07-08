-- Align cloud production schema with local Docker baseline after 20260714130000 rollback drift.
-- Idempotent where possible (IF EXISTS / IF NOT EXISTS) so local linked push stays safe.

-- 1) Staff: login_name only (drop redundant email restored by rollback).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.restaurant_staff_accounts
    WHERE login_name IS NULL OR btrim(login_name) = ''
  ) THEN
    RAISE EXCEPTION 'restaurant_staff_accounts.login_name must be populated before dropping email';
  END IF;
END
$$;
ALTER TABLE public.restaurant_staff_accounts
  DROP CONSTRAINT IF EXISTS restaurant_staff_accounts_email_key;
ALTER TABLE public.restaurant_staff_accounts
  DROP COLUMN IF EXISTS email;
CREATE UNIQUE INDEX IF NOT EXISTS restaurant_staff_accounts_login_name_key
  ON public.restaurant_staff_accounts (login_name);
-- 2) Print stations: drop unused ticket_layout (matches local + 20260714120000).
CREATE OR REPLACE FUNCTION public.seed_default_print_stations_for_restaurant() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  insert into public.print_stations (restaurant_id, name_pt, name_en, name_zh, sort_order)
  select new.id, 'Cozinha', 'Kitchen', '后厨', 0
  where not exists (
    select 1 from public.print_stations ps
    where ps.restaurant_id = new.id and ps.name_pt = 'Cozinha'
  );
  insert into public.print_stations (restaurant_id, name_pt, name_en, name_zh, sort_order)
  select new.id, 'Bar', 'Bar', '吧台', 1
  where not exists (
    select 1 from public.print_stations ps
    where ps.restaurant_id = new.id and ps.name_pt = 'Bar'
  );
  return new;
end;
$$;
UPDATE public.print_jobs
SET payload = payload - 'ticket_layout'
WHERE type = 'station_ticket'
  AND payload ? 'ticket_layout';
ALTER TABLE public.print_stations
  DROP CONSTRAINT IF EXISTS print_stations_ticket_layout_check;
ALTER TABLE public.print_stations
  DROP COLUMN IF EXISTS ticket_layout;
-- 3) Table seat capacity for floor board + table settings (matches local + 20260713120000).
ALTER TABLE public.restaurant_tables
  ADD COLUMN IF NOT EXISTS seat_min integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS seat_max integer NOT NULL DEFAULT 4;
ALTER TABLE public.restaurant_tables
  DROP CONSTRAINT IF EXISTS restaurant_tables_seat_min_range;
ALTER TABLE public.restaurant_tables
  ADD CONSTRAINT restaurant_tables_seat_min_range
  CHECK (seat_min >= 1 AND seat_min <= 99);
ALTER TABLE public.restaurant_tables
  DROP CONSTRAINT IF EXISTS restaurant_tables_seat_max_range;
ALTER TABLE public.restaurant_tables
  ADD CONSTRAINT restaurant_tables_seat_max_range
  CHECK (seat_max >= 1 AND seat_max <= 99);
ALTER TABLE public.restaurant_tables
  DROP CONSTRAINT IF EXISTS restaurant_tables_seat_range_valid;
ALTER TABLE public.restaurant_tables
  ADD CONSTRAINT restaurant_tables_seat_range_valid
  CHECK (seat_min <= seat_max);
-- 4) merge_table_sessions: revert to initial single-buffet merge (matches local Docker).
CREATE OR REPLACE FUNCTION public.merge_table_sessions(
  p_restaurant_id uuid,
  p_source_table_id uuid,
  p_target_table_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $_$
declare
  v_source_session public.table_sessions%rowtype;
  v_target_session public.table_sessions%rowtype;
  v_source_split public.bill_splits%rowtype;
  v_target_split public.bill_splits%rowtype;
  v_target_display text;
  v_buffet_id uuid;
  v_buffet_name text;
  v_distinct_buffets int;
  v_adults int := 0;
  v_children int := 0;
  v_adult_price numeric;
  v_child_price numeric;
  v_rule_id uuid;
  v_line_total numeric;
  v_carrier_order_id uuid;
  v_carrier_items jsonb;
  v_merged_line jsonb;
  v_now text;
  v_new_items jsonb;
  v_new_total numeric;
  v_order_rec record;
begin
  if p_source_table_id = p_target_table_id then
    raise exception 'source and target table cannot be the same';
  end if;

  select display_name into v_target_display
  from public.get_active_restaurant_table(p_restaurant_id, p_target_table_id);
  if v_target_display is null then
    raise exception 'invalid target table';
  end if;

  select *
  into v_source_session
  from public.table_sessions
  where restaurant_id = p_restaurant_id
    and table_id = p_source_table_id
    and status in ('open', 'billing')
  order by opened_at desc
  limit 1
  for update;

  if not found then
    raise exception 'source table has no active session';
  end if;

  select *
  into v_target_session
  from public.table_sessions
  where restaurant_id = p_restaurant_id
    and table_id = p_target_table_id
    and status in ('open', 'billing')
  order by opened_at desc
  limit 1
  for update;

  if not found then
    raise exception 'target table has no active session';
  end if;

  update public.bill_splits
  set session_id = v_source_session.id
  where restaurant_id = p_restaurant_id
    and table_id = p_source_table_id
    and status in ('pending', 'confirmed', 'requested')
    and session_id is null;

  update public.bill_splits
  set session_id = v_target_session.id
  where restaurant_id = p_restaurant_id
    and table_id = p_target_table_id
    and status in ('pending', 'confirmed', 'requested')
    and session_id is null;

  update public.orders
  set session_id = v_target_session.id
  where restaurant_id = p_restaurant_id
    and status in ('pending', 'cooking', 'done')
    and (
      session_id = v_source_session.id
      or (
        table_id = p_source_table_id
        and (session_id is null or session_id = v_source_session.id)
      )
    );

  select
    count(distinct bl.buffet_id),
    (min(bl.buffet_id::text))::uuid,
    coalesce(sum(bl.adults), 0)::int,
    coalesce(sum(bl.children), 0)::int
  into v_distinct_buffets, v_buffet_id, v_adults, v_children
  from (
    select
      (el->>'buffet_id')::uuid as buffet_id,
      coalesce((el->>'adult_count')::int, 0) as adults,
      coalesce((el->>'child_count')::int, 0) as children
    from public.orders o
    cross join lateral jsonb_array_elements(coalesce(o.items, '[]'::jsonb)) el
    where o.restaurant_id = p_restaurant_id
      and o.session_id = v_target_session.id
      and o.status in ('pending', 'cooking', 'done')
      and el->>'kind' = 'buffet_base'
      and coalesce(el->>'item_status', 'pending') <> 'voided'
      and el ? 'buffet_id'
      and (el->>'buffet_id') ~* '^[0-9a-f-]{36}$'
  ) bl;

  if coalesce(v_distinct_buffets, 0) > 1 then
    raise exception 'multiple buffet types cannot be merged';
  end if;

  if v_buffet_id is not null and (v_adults + v_children) > 0 then
    for v_order_rec in
      select o.id, o.items
      from public.orders o
      where o.restaurant_id = p_restaurant_id
        and o.session_id = v_target_session.id
        and o.status in ('pending', 'cooking', 'done')
    loop
      v_new_items := public.void_active_buffet_lines_in_items(v_order_rec.items);
      v_new_total := public.recalc_order_total_from_items(v_new_items);
      update public.orders
      set items = v_new_items,
          total_amount = v_new_total
      where id = v_order_rec.id;
    end loop;

    select r.adult_price, r.child_price, r.rule_id
    into v_adult_price, v_child_price, v_rule_id
    from public.resolve_buffet_prices(p_restaurant_id, v_buffet_id, now()) r
    limit 1;

    if v_adult_price is null or v_child_price is null then
      raise exception 'no buffet price rule at merge time';
    end if;

    select b.name into v_buffet_name
    from public.buffets b
    where b.id = v_buffet_id
      and b.restaurant_id = p_restaurant_id;

    v_line_total := v_adults * v_adult_price + v_children * v_child_price;
    v_now := to_char(timezone('utc', now()), 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"');

    v_merged_line := jsonb_build_object(
      'id', 'buffet:' || v_buffet_id::text,
      'kind', 'buffet_base',
      'name', coalesce(v_buffet_name, 'Buffet'),
      'name_pt', coalesce(v_buffet_name, 'Buffet'),
      'qty', 1,
      'price', v_line_total,
      'emoji', '🍽️',
      'item_status', 'done',
      'buffet_id', v_buffet_id::text,
      'adult_count', v_adults,
      'child_count', v_children,
      'adult_unit_price', v_adult_price,
      'child_unit_price', v_child_price,
      'price_rule_id', v_rule_id::text,
      'added_at', v_now,
      'batch_id', '__buffet__'
    );

    select o.id, o.items
    into v_carrier_order_id, v_carrier_items
    from public.orders o
    where o.restaurant_id = p_restaurant_id
      and o.session_id = v_target_session.id
      and o.status in ('pending', 'cooking', 'done')
    order by (o.table_id = p_target_table_id) desc, o.created_at desc
    limit 1;

    if v_carrier_order_id is null then
      insert into public.orders (
        restaurant_id,
        session_id,
        table_id,
        display_name,
        status,
        items,
        total_amount
      )
      values (
        p_restaurant_id,
        v_target_session.id,
        p_target_table_id,
        v_target_display,
        'done',
        jsonb_build_array(v_merged_line),
        v_line_total
      );
    else
      v_new_items := coalesce(v_carrier_items, '[]'::jsonb) || v_merged_line;
      v_new_total := public.recalc_order_total_from_items(v_new_items);
      update public.orders
      set items = v_new_items,
          total_amount = v_new_total,
          status = case
            when exists (
              select 1
              from jsonb_array_elements(v_new_items) el
              where coalesce(el->>'item_status', 'pending') not in ('voided', 'done')
                and coalesce(el->>'kind', 'menu') <> 'buffet_base'
            ) then status
            else 'done'
          end
      where id = v_carrier_order_id;
    end if;
  end if;

  select *
  into v_source_split
  from public.bill_splits
  where session_id = v_source_session.id
    and status in ('pending', 'confirmed', 'requested')
  order by created_at desc
  limit 1
  for update;

  select *
  into v_target_split
  from public.bill_splits
  where session_id = v_target_session.id
    and status in ('pending', 'confirmed', 'requested')
  order by created_at desc
  limit 1
  for update;

  if v_source_split.id is not null and v_target_split.id is not null then
    update public.bill_splits
    set order_ids = (
          select array_agg(distinct x)
          from unnest(coalesce(v_target_split.order_ids, '{}'::uuid[]) || coalesce(v_source_split.order_ids, '{}'::uuid[])) as x
        ),
        persons = coalesce(v_target_split.persons, '[]'::jsonb) || coalesce(v_source_split.persons, '[]'::jsonb),
        result = coalesce(v_target_split.result, '[]'::jsonb) || coalesce(v_source_split.result, '[]'::jsonb),
        total_amount = coalesce(v_target_split.total_amount, 0) + coalesce(v_source_split.total_amount, 0)
    where id = v_target_split.id;

    delete from public.bill_splits
    where id = v_source_split.id;
  elsif v_source_split.id is not null then
    update public.bill_splits
    set session_id = v_target_session.id,
        table_id = p_target_table_id,
        display_name = v_target_display
    where id = v_source_split.id;
  end if;

  update public.bill_splits
  set session_id = v_target_session.id,
      table_id = p_target_table_id,
      display_name = v_target_display
  where session_id = v_source_session.id
    and status in ('pending', 'confirmed', 'requested');

  update public.table_sessions
  set status = 'closed',
      closed_at = now(),
      closed_reason = 'merged',
      merge_into_session_id = v_target_session.id
  where id = v_source_session.id;

  return v_target_session.id;
end;
$_$;
