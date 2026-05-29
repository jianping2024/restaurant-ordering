-- Mesa restaurant ordering: consolidated schema baseline (squashed from prior migrations).
-- Generated from linked Supabase project schema dump; no business data.
-- Fresh environments: supabase db reset / db push applies this file only.
-- Storage bucket policies appended below (excluded from default supabase db dump).




SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."auth_owned_restaurant_ids"() RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select id from public.restaurants where owner_id = auth.uid();
$$;


ALTER FUNCTION "public"."auth_owned_restaurant_ids"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auth_staff_restaurant_ids"() RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select restaurant_id
  from public.restaurant_staff_accounts
  where user_id = auth.uid()
    and disabled_at is null;
$$;


ALTER FUNCTION "public"."auth_staff_restaurant_ids"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."confirm_bill_split_payment"("p_restaurant_id" "uuid", "p_bill_split_id" "uuid", "p_person_index" integer, "p_discount_rate" numeric DEFAULT 0) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_split public.bill_splits%rowtype;
  v_raw_result jsonb;
  v_base_rows jsonb;
  v_discounted jsonb;
  v_next_result jsonb := '[]'::jsonb;
  v_elem jsonb;
  v_row jsonb;
  v_all_paid boolean := true;
  v_final_amount numeric := 0;
  v_rate numeric;
  v_factor numeric;
  v_i integer;
  v_len integer;
  v_session public.table_sessions%rowtype;
  v_was_paid boolean;
begin
  if p_person_index is null or p_person_index < 0 then
    return jsonb_build_object('ok', false, 'code', 'invalid_person_index');
  end if;

  select *
  into v_split
  from public.bill_splits
  where id = p_bill_split_id
    and restaurant_id = p_restaurant_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'bill_split_not_found');
  end if;

  v_raw_result := coalesce(v_split.result, '[]'::jsonb);
  if jsonb_typeof(v_raw_result) <> 'array' then
    v_raw_result := '[]'::jsonb;
  end if;

  if jsonb_array_length(v_raw_result) = 0 then
    if coalesce(v_split.total_amount, 0) > 0 then
      v_base_rows := jsonb_build_array(
        jsonb_build_object('name', 'Total', 'amount', v_split.total_amount)
      );
    else
      return jsonb_build_object('ok', false, 'code', 'empty_split');
    end if;
  else
    v_base_rows := v_raw_result;
  end if;

  v_len := jsonb_array_length(v_base_rows);
  if p_person_index >= v_len then
    return jsonb_build_object('ok', false, 'code', 'invalid_person_index');
  end if;

  v_rate := greatest(0, least(100, coalesce(p_discount_rate, 0)));
  v_factor := 1 - v_rate / 100;

  select coalesce(
    jsonb_agg(
      elem || jsonb_build_object(
        'amount',
        coalesce((elem->>'amount')::numeric, 0) * v_factor
      )
    ),
    '[]'::jsonb
  )
  into v_discounted
  from jsonb_array_elements(v_base_rows) as elem;

  v_row := v_discounted -> p_person_index;
  v_was_paid := coalesce((v_row->>'paid')::boolean, false);
  if v_was_paid then
    return jsonb_build_object('ok', false, 'code', 'already_paid');
  end if;

  for v_i in 0 .. v_len - 1 loop
    v_elem := v_discounted -> v_i;
    if v_i = p_person_index then
      v_elem := v_elem || jsonb_build_object('paid', true);
    end if;
    v_next_result := v_next_result || jsonb_build_array(v_elem);
  end loop;

  for v_i in 0 .. v_len - 1 loop
    if not coalesce((v_next_result -> v_i ->> 'paid')::boolean, false) then
      v_all_paid := false;
      exit;
    end if;
  end loop;

  select coalesce(sum((elem->>'amount')::numeric), 0)
  into v_final_amount
  from jsonb_array_elements(v_next_result) as elem;

  update public.bill_splits
  set
    status = case when v_all_paid then 'paid' else 'requested' end,
    total_amount = case when v_all_paid then v_final_amount else v_split.total_amount end,
    result = v_next_result
  where id = p_bill_split_id;

  v_row := v_next_result -> p_person_index;

  if v_all_paid and v_split.session_id is not null then
    select *
    into v_session
    from public.table_sessions
    where id = v_split.session_id
    for update;

    if not found then
      return jsonb_build_object(
        'ok', false,
        'code', 'session_close_failed',
        'message', 'session not found'
      );
    end if;

    update public.table_sessions
    set status = 'closed',
        closed_at = now()
    where id = v_split.session_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'all_paid', v_all_paid,
    'result', v_next_result,
    'final_amount', v_final_amount,
    'session_id', v_split.session_id,
    'table_id', v_split.table_id,
    'display_name', v_split.display_name,
    'order_ids', coalesce(to_jsonb(v_split.order_ids), '[]'::jsonb),
    'row_name', v_row ->> 'name',
    'row_amount', coalesce((v_row->>'amount')::numeric, 0),
    'confirmed_person_index', p_person_index,
    'newly_paid', true,
    'should_print_split',
      v_split.session_id is not null and v_len > 1,
    'should_print_final',
      v_all_paid and v_split.session_id is not null,
    'should_close_session',
      v_all_paid and v_split.session_id is not null
  );
exception
  when others then
    return jsonb_build_object(
      'ok', false,
      'code', 'bill_update_failed',
      'message', sqlerrm
    );
end;
$$;


ALTER FUNCTION "public"."confirm_bill_split_payment"("p_restaurant_id" "uuid", "p_bill_split_id" "uuid", "p_person_index" integer, "p_discount_rate" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_print_station_same_restaurant"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if new.print_station_id is null then
    return new;
  end if;
  if not exists (
    select 1
    from public.print_stations ps
    where ps.id = new.print_station_id
      and ps.restaurant_id = new.restaurant_id
  ) then
    raise exception 'print_station_id must reference print_stations for the same restaurant';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."enforce_print_station_same_restaurant"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."restaurant_tables" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "display_name" "text" NOT NULL,
    "sort_order" integer NOT NULL,
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "restaurant_tables_display_name_len" CHECK ((("char_length"("display_name") >= 1) AND ("char_length"("display_name") <= 16)))
);


ALTER TABLE "public"."restaurant_tables" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_active_restaurant_table"("p_restaurant_id" "uuid", "p_table_id" "uuid") RETURNS "public"."restaurant_tables"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select rt.*
  from public.restaurant_tables rt
  where rt.restaurant_id = p_restaurant_id
    and rt.id = p_table_id
    and rt.deleted_at is null
  limit 1;
$$;


ALTER FUNCTION "public"."get_active_restaurant_table"("p_restaurant_id" "uuid", "p_table_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_active_restaurant_staff"("p_restaurant_id" "uuid", "p_roles" "text"[] DEFAULT ARRAY['kitchen'::"text", 'waiter'::"text"]) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.restaurant_staff_accounts a
    where a.user_id = auth.uid()
      and a.restaurant_id = p_restaurant_id
      and a.disabled_at is null
      and a.role = any(p_roles)
  );
$$;


ALTER FUNCTION "public"."is_active_restaurant_staff"("p_restaurant_id" "uuid", "p_roles" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."merge_multiple_table_sessions"("p_restaurant_id" "uuid", "p_source_table_ids" "uuid"[], "p_target_table_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_source_id uuid;
  v_target_session_id uuid;
begin
  if p_source_table_ids is null or array_length(p_source_table_ids, 1) is null then
    raise exception 'source tables cannot be empty';
  end if;

  if p_target_table_id = any(p_source_table_ids) then
    raise exception 'target cannot be among sources';
  end if;

  foreach v_source_id in array p_source_table_ids loop
    v_target_session_id := public.merge_table_sessions(
      p_restaurant_id,
      v_source_id,
      p_target_table_id
    );
  end loop;

  return v_target_session_id;
end;
$$;


ALTER FUNCTION "public"."merge_multiple_table_sessions"("p_restaurant_id" "uuid", "p_source_table_ids" "uuid"[], "p_target_table_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."merge_table_sessions"("p_restaurant_id" "uuid", "p_source_table_id" "uuid", "p_target_table_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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

  -- Attach all source-session orders to target session; keep each order's table_id (who ordered).
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


ALTER FUNCTION "public"."merge_table_sessions"("p_restaurant_id" "uuid", "p_source_table_id" "uuid", "p_target_table_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recalc_order_total_from_items"("p_items" "jsonb") RETURNS numeric
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select coalesce(sum(
    (elem->>'price')::numeric * coalesce(nullif(elem->>'qty', '')::numeric, 1::numeric)
  ), 0::numeric)
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) elem
  where coalesce(elem->>'item_status', 'pending') <> 'voided';
$$;


ALTER FUNCTION "public"."recalc_order_total_from_items"("p_items" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolve_buffet_prices"("p_restaurant_id" "uuid", "p_buffet_id" "uuid", "p_at" timestamp with time zone DEFAULT "now"()) RETURNS TABLE("adult_price" numeric, "child_price" numeric, "rule_id" "uuid", "time_slot_id" "uuid")
    LANGUAGE "plpgsql" STABLE
    AS $$
declare
  v_tz text := 'Europe/Lisbon';
  v_date date;
  v_t time;
  v_dow int;
  v_override text;
  v_cal text;
  v_slot_id uuid;
  v_friday_from time;
begin
  v_date := (p_at at time zone v_tz)::date;
  v_t := (p_at at time zone v_tz)::time;
  v_dow := extract(dow from (p_at at time zone v_tz))::int;

  select r.buffet_friday_weekend_from into v_friday_from
  from public.restaurants r
  where r.id = p_restaurant_id;

  select bco.kind into v_override
  from public.buffet_calendar_overrides bco
  where bco.restaurant_id = p_restaurant_id
    and bco.on_date = v_date;

  if v_override = 'holiday' then
    v_cal := 'holiday';
  elsif v_override = 'special' then
    v_cal := 'special';
  elsif v_dow in (0, 6) then
    v_cal := 'weekend';
  else
    v_cal := 'weekday';
  end if;

  if v_cal = 'weekday'
    and v_dow = 5
    and v_friday_from is not null
    and v_t >= v_friday_from
  then
    v_cal := 'weekend';
  end if;

  select s.id into v_slot_id
  from (
    select
      ts.id,
      case
        when ts.start_time <= ts.end_time
          and v_t >= ts.start_time
          and v_t < ts.end_time
        then 0::double precision
        when ts.start_time > ts.end_time
          and (v_t >= ts.start_time or v_t < ts.end_time)
        then 0::double precision
        when ts.start_time <= ts.end_time
          and v_t < ts.start_time
        then extract(epoch from (ts.start_time - v_t))
        when ts.start_time <= ts.end_time
          and v_t >= ts.end_time
        then extract(epoch from (v_t - ts.end_time))
        else
          86400::double precision
      end as dist,
      ts.sort_order,
      ts.name
    from public.buffet_time_slots ts
    where ts.restaurant_id = p_restaurant_id
      and v_dow = any (ts.weekdays)
      and exists (
        select 1
        from public.buffet_price_rules r
        where r.time_slot_id = ts.id
          and r.restaurant_id = p_restaurant_id
          and r.buffet_id = p_buffet_id
          and r.calendar_kind = v_cal
          and r.is_active
          and v_date between r.valid_from and r.valid_to
      )
  ) s
  order by s.dist asc, s.sort_order asc, s.name asc
  limit 1;

  if v_slot_id is null then
    return query select null::numeric, null::numeric, null::uuid, null::uuid;
    return;
  end if;

  return query
  select r.adult_price, r.child_price, r.id, r.time_slot_id
  from public.buffet_price_rules r
  where r.restaurant_id = p_restaurant_id
    and r.buffet_id = p_buffet_id
    and r.time_slot_id = v_slot_id
    and r.calendar_kind = v_cal
    and r.is_active
    and v_date between r.valid_from and r.valid_to
  order by r.priority desc, r.valid_from desc
  limit 1;
end;
$$;


ALTER FUNCTION "public"."resolve_buffet_prices"("p_restaurant_id" "uuid", "p_buffet_id" "uuid", "p_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."seed_default_print_stations_for_restaurant"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  insert into public.print_stations (restaurant_id, name_pt, name_en, name_zh, sort_order, ticket_layout)
  select new.id, 'Cozinha', 'Kitchen', '后厨', 0, 'kitchen'
  where not exists (
    select 1 from public.print_stations ps where ps.restaurant_id = new.id and ps.ticket_layout = 'kitchen'
  );
  insert into public.print_stations (restaurant_id, name_pt, name_en, name_zh, sort_order, ticket_layout)
  select new.id, 'Bar', 'Bar', '吧台', 1, 'beverage'
  where not exists (
    select 1 from public.print_stations ps where ps.restaurant_id = new.id and ps.ticket_layout = 'beverage'
  );
  return new;
end;
$$;


ALTER FUNCTION "public"."seed_default_print_stations_for_restaurant"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."seed_default_restaurant_tables_for_restaurant"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.restaurant_tables (restaurant_id, display_name, sort_order)
  select new.id, 'A-' || lpad(i::text, 2, '0'), i
  from generate_series(1, 10) as i
  where not exists (
    select 1 from public.restaurant_tables rt where rt.restaurant_id = new.id
  );
  return new;
end;
$$;


ALTER FUNCTION "public"."seed_default_restaurant_tables_for_restaurant"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."transfer_table_session"("p_restaurant_id" "uuid", "p_from_table_id" "uuid", "p_to_table_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_source_session public.table_sessions%rowtype;
  v_target_session_id uuid;
  v_target_display text;
begin
  if p_from_table_id = p_to_table_id then
    raise exception 'source and target table cannot be the same';
  end if;

  select display_name into v_target_display
  from public.get_active_restaurant_table(p_restaurant_id, p_to_table_id);
  if v_target_display is null then
    raise exception 'invalid target table';
  end if;

  if not exists (
    select 1 from public.get_active_restaurant_table(p_restaurant_id, p_from_table_id)
  ) then
    raise exception 'invalid source table';
  end if;

  select *
  into v_source_session
  from public.table_sessions
  where restaurant_id = p_restaurant_id
    and table_id = p_from_table_id
    and status in ('open', 'billing')
  order by opened_at desc
  limit 1
  for update;

  if not found then
    raise exception 'source table has no active session';
  end if;

  select id
  into v_target_session_id
  from public.table_sessions
  where restaurant_id = p_restaurant_id
    and table_id = p_to_table_id
    and status in ('open', 'billing')
  order by opened_at desc
  limit 1
  for update;

  if v_target_session_id is not null then
    raise exception 'target table already has active session';
  end if;

  update public.table_sessions
  set table_id = p_to_table_id
  where id = v_source_session.id;

  update public.orders
  set table_id = p_to_table_id,
      display_name = v_target_display,
      session_id = coalesce(session_id, v_source_session.id)
  where restaurant_id = p_restaurant_id
    and table_id = p_from_table_id
    and status in ('pending', 'cooking', 'done')
    and (session_id is null or session_id = v_source_session.id);

  update public.bill_splits
  set table_id = p_to_table_id,
      display_name = v_target_display,
      session_id = coalesce(session_id, v_source_session.id)
  where restaurant_id = p_restaurant_id
    and table_id = p_from_table_id
    and status in ('pending', 'confirmed', 'requested')
    and (session_id is null or session_id = v_source_session.id);

  return v_source_session.id;
end;
$$;


ALTER FUNCTION "public"."transfer_table_session"("p_restaurant_id" "uuid", "p_from_table_id" "uuid", "p_to_table_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."void_active_buffet_lines_in_items"("p_items" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_now text := to_char(timezone('utc', now()), 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
begin
  return coalesce((
    select jsonb_agg(
      case
        when elem->>'kind' = 'buffet_base'
             and coalesce(elem->>'item_status', 'pending') <> 'voided'
        then elem || jsonb_build_object('item_status', 'voided', 'voided_at', v_now)
        else elem
      end
    )
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) elem
  ), '[]'::jsonb);
end;
$$;


ALTER FUNCTION "public"."void_active_buffet_lines_in_items"("p_items" "jsonb") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bill_splits" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "order_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "split_mode" "text" NOT NULL,
    "persons" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "result" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "total_amount" numeric(10,2) DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "session_id" "uuid",
    "table_id" "uuid" NOT NULL,
    "display_name" "text" NOT NULL,
    CONSTRAINT "bill_splits_split_mode_check" CHECK (("split_mode" = ANY (ARRAY['even'::"text", 'by_item'::"text", 'custom'::"text"]))),
    CONSTRAINT "bill_splits_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'confirmed'::"text", 'requested'::"text", 'paid'::"text", 'cancelled'::"text"])))
);

ALTER TABLE ONLY "public"."bill_splits" REPLICA IDENTITY FULL;


ALTER TABLE "public"."bill_splits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."buffet_calendar_overrides" (
    "restaurant_id" "uuid" NOT NULL,
    "on_date" "date" NOT NULL,
    "kind" "text" NOT NULL,
    CONSTRAINT "buffet_calendar_overrides_kind_check" CHECK (("kind" = ANY (ARRAY['holiday'::"text", 'special'::"text"])))
);

ALTER TABLE ONLY "public"."buffet_calendar_overrides" REPLICA IDENTITY FULL;


ALTER TABLE "public"."buffet_calendar_overrides" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."buffet_price_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "buffet_id" "uuid" NOT NULL,
    "time_slot_id" "uuid" NOT NULL,
    "calendar_kind" "text" NOT NULL,
    "valid_from" "date" NOT NULL,
    "valid_to" "date" NOT NULL,
    "adult_price" numeric(10,2) NOT NULL,
    "child_price" numeric(10,2) NOT NULL,
    "priority" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "buffet_price_rules_calendar_kind_check" CHECK (("calendar_kind" = ANY (ARRAY['weekday'::"text", 'weekend'::"text", 'holiday'::"text", 'special'::"text"]))),
    CONSTRAINT "buffet_price_rules_valid_range" CHECK (("valid_to" >= "valid_from"))
);

ALTER TABLE ONLY "public"."buffet_price_rules" REPLICA IDENTITY FULL;


ALTER TABLE "public"."buffet_price_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."buffet_time_slots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "weekdays" integer[] DEFAULT ARRAY[0, 1, 2, 3, 4, 5, 6] NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."buffet_time_slots" REPLICA IDENTITY FULL;


ALTER TABLE "public"."buffet_time_slots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."buffets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."buffets" REPLICA IDENTITY FULL;


ALTER TABLE "public"."buffets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dish_feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "session_id" "uuid" NOT NULL,
    "order_id" "uuid" NOT NULL,
    "menu_item_id" "uuid" NOT NULL,
    "vote" "text" NOT NULL,
    "reasons" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "comment" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "dish_feedback_vote_check" CHECK (("vote" = ANY (ARRAY['up'::"text", 'down'::"text"])))
);


ALTER TABLE "public"."dish_feedback" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feedback_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "session_id" "uuid" NOT NULL,
    "source" "text" DEFAULT 'bill_success'::"text" NOT NULL,
    "shown_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "skipped_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."feedback_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."menu_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "parent_id" "uuid",
    "name_pt" "text" NOT NULL,
    "name_en" "text",
    "name_zh" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "print_station_id" "uuid",
    "item_code" character varying(10)
);


ALTER TABLE "public"."menu_categories" OWNER TO "postgres";


COMMENT ON COLUMN "public"."menu_categories"."item_code" IS 'Optional category code (max 10), printed on tickets before dish code.';



CREATE TABLE IF NOT EXISTS "public"."menu_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "name_pt" "text" NOT NULL,
    "name_en" "text",
    "name_zh" "text",
    "description_pt" "text",
    "description_en" "text",
    "price" numeric(10,2) NOT NULL,
    "category" "text" NOT NULL,
    "emoji" "text" DEFAULT '🍽️'::"text" NOT NULL,
    "available" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "image_url" "text",
    "note_preset_keys" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "category_en" "text",
    "category_zh" "text",
    "category_id" "uuid",
    "print_station_id" "uuid",
    "item_code" character varying(10)
);


ALTER TABLE "public"."menu_items" OWNER TO "postgres";


COMMENT ON COLUMN "public"."menu_items"."item_code" IS 'Optional dish code (max 10), printed on tickets after category path.';



CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "items" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "total_amount" numeric(10,2) DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "session_id" "uuid",
    "table_id" "uuid" NOT NULL,
    "display_name" "text" NOT NULL,
    CONSTRAINT "orders_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'cooking'::"text", 'done'::"text"])))
);

ALTER TABLE ONLY "public"."orders" REPLICA IDENTITY FULL;


ALTER TABLE "public"."orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."print_agent_devices" (
    "id" "uuid" NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "pairing_id" "uuid",
    "label" "text",
    "paired_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "valid_until" timestamp with time zone NOT NULL,
    "revoked_at" timestamp with time zone,
    "last_seen" timestamp with time zone,
    "routing_snapshot" "jsonb",
    "agent_version" "text",
    "mapped_station_count" integer,
    "last_print_at" timestamp with time zone,
    "last_print_status" "text",
    "schedule_open" boolean
);


ALTER TABLE "public"."print_agent_devices" OWNER TO "postgres";


COMMENT ON COLUMN "public"."print_agent_devices"."routing_snapshot" IS 'Receipt printer options synced from agent configure/setup: { receipt_printers: [{ id, label, role }], updated_at }';



COMMENT ON COLUMN "public"."print_agent_devices"."agent_version" IS 'MesaPrintAgent build version from heartbeat.';



COMMENT ON COLUMN "public"."print_agent_devices"."mapped_station_count" IS 'Non-empty station_printers mappings at last heartbeat.';



COMMENT ON COLUMN "public"."print_agent_devices"."last_print_at" IS 'Timestamp of last print attempt reported by agent.';



COMMENT ON COLUMN "public"."print_agent_devices"."last_print_status" IS 'done | failed from last print attempt.';



COMMENT ON COLUMN "public"."print_agent_devices"."schedule_open" IS 'Whether agent was inside business hours at last heartbeat.';



CREATE TABLE IF NOT EXISTS "public"."print_agent_pairings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "consumed_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "revoked_at" timestamp with time zone,
    CONSTRAINT "print_agent_pairings_code_check" CHECK (("code" ~ '^[0-9]{6}$'::"text"))
);


ALTER TABLE "public"."print_agent_pairings" OWNER TO "postgres";


COMMENT ON COLUMN "public"."print_agent_pairings"."revoked_at" IS 'Set when the restaurant owner voids an unused code before expiry; frees a pending slot.';



CREATE TABLE IF NOT EXISTS "public"."print_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "claimed_by" "text",
    "attempts" integer DEFAULT 0 NOT NULL,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "table_display" "text" GENERATED ALWAYS AS (NULLIF("btrim"(("payload" ->> 'display_name'::"text")), ''::"text")) STORED,
    "table_id" "uuid" GENERATED ALWAYS AS (
CASE
    WHEN (("payload" ? 'table_id'::"text") AND (("payload" ->> 'table_id'::"text") ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'::"text")) THEN (("payload" ->> 'table_id'::"text"))::"uuid"
    ELSE NULL::"uuid"
END) STORED,
    CONSTRAINT "print_jobs_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'done'::"text", 'failed'::"text"]))),
    CONSTRAINT "print_jobs_type_check" CHECK (("type" = ANY (ARRAY['order_receipt'::"text", 'station_ticket'::"text", 'pre_bill'::"text"])))
);

ALTER TABLE ONLY "public"."print_jobs" REPLICA IDENTITY FULL;


ALTER TABLE "public"."print_jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."print_stations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "name_pt" "text" NOT NULL,
    "name_en" "text",
    "name_zh" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "ticket_layout" "text" DEFAULT 'standard'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "print_stations_ticket_layout_check" CHECK (("ticket_layout" = ANY (ARRAY['kitchen'::"text", 'beverage'::"text", 'standard'::"text"])))
);


ALTER TABLE "public"."print_stations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."restaurant_staff_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "login_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "disabled_at" timestamp with time zone,
    CONSTRAINT "restaurant_staff_accounts_role_check" CHECK (("role" = ANY (ARRAY['kitchen'::"text", 'waiter'::"text", 'cashier'::"text"])))
);


ALTER TABLE "public"."restaurant_staff_accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."restaurants" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "logo_url" "text",
    "address" "text",
    "phone" "text",
    "plan" "text" DEFAULT 'free'::"text" NOT NULL,
    "kitchen_password" "text" DEFAULT '1234'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "waiter_password" "text" DEFAULT '5678'::"text" NOT NULL,
    "geo_latitude" double precision,
    "geo_longitude" double precision,
    "print_locale" "text" DEFAULT 'pt'::"text" NOT NULL,
    "print_agent_config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "kitchen_password_version" integer DEFAULT 1 NOT NULL,
    "waiter_password_version" integer DEFAULT 1 NOT NULL,
    "order_radius_meters" integer DEFAULT 50 NOT NULL,
    "buffet_friday_weekend_from" time without time zone,
    CONSTRAINT "restaurants_order_radius_meters_check" CHECK ((("order_radius_meters" >= 10) AND ("order_radius_meters" <= 10000))),
    CONSTRAINT "restaurants_plan_check" CHECK (("plan" = ANY (ARRAY['free'::"text", 'pro'::"text"]))),
    CONSTRAINT "restaurants_print_locale_check" CHECK (("print_locale" = ANY (ARRAY['zh'::"text", 'en'::"text", 'pt'::"text"])))
);


ALTER TABLE "public"."restaurants" OWNER TO "postgres";


COMMENT ON COLUMN "public"."restaurants"."kitchen_password" IS 'bcrypt hash of 4-digit kitchen PIN';



COMMENT ON COLUMN "public"."restaurants"."waiter_password" IS 'bcrypt hash of 4-digit waiter PIN';



COMMENT ON COLUMN "public"."restaurants"."print_agent_config" IS 'Print agent schedule/poll JSON: { schedule, poll }. Printers stay on the local agent config.';



COMMENT ON COLUMN "public"."restaurants"."kitchen_password_version" IS 'Bumped when kitchen PIN changes; must match staff session JWT pwd_ver for role kitchen';



COMMENT ON COLUMN "public"."restaurants"."waiter_password_version" IS 'Bumped when waiter PIN changes; must match staff session JWT pwd_ver for role waiter';



COMMENT ON COLUMN "public"."restaurants"."buffet_friday_weekend_from" IS 'Lisbon local time: on Fridays at or after this time, buffet pricing uses calendar_kind=weekend. NULL = disabled.';



CREATE OR REPLACE VIEW "public"."restaurants_public" WITH ("security_invoker"='false') AS
 SELECT "id",
    "name",
    "slug",
    "logo_url",
    "address",
    "phone",
    "plan",
    "geo_latitude",
    "geo_longitude",
    "print_locale",
    "created_at",
    "order_radius_meters"
   FROM "public"."restaurants";


ALTER VIEW "public"."restaurants_public" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."table_sessions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "opened_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "closed_at" timestamp with time zone,
    "merge_into_session_id" "uuid",
    "closed_reason" "text",
    "table_id" "uuid" NOT NULL,
    "closed_by_user_id" "uuid",
    CONSTRAINT "table_sessions_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'billing'::"text", 'closed'::"text"])))
);

ALTER TABLE ONLY "public"."table_sessions" REPLICA IDENTITY FULL;


ALTER TABLE "public"."table_sessions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."table_sessions"."closed_by_user_id" IS 'Supabase auth user who force-closed the session (waiter/owner). Null for auto_nightly, merge, or paid checkout close.';



ALTER TABLE ONLY "public"."bill_splits"
    ADD CONSTRAINT "bill_splits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."buffet_calendar_overrides"
    ADD CONSTRAINT "buffet_calendar_overrides_pkey" PRIMARY KEY ("restaurant_id", "on_date");



ALTER TABLE ONLY "public"."buffet_price_rules"
    ADD CONSTRAINT "buffet_price_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."buffet_time_slots"
    ADD CONSTRAINT "buffet_time_slots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."buffets"
    ADD CONSTRAINT "buffets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dish_feedback"
    ADD CONSTRAINT "dish_feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feedback_sessions"
    ADD CONSTRAINT "feedback_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."menu_categories"
    ADD CONSTRAINT "menu_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."menu_items"
    ADD CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."print_agent_devices"
    ADD CONSTRAINT "print_agent_devices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."print_agent_pairings"
    ADD CONSTRAINT "print_agent_pairings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."print_jobs"
    ADD CONSTRAINT "print_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."print_stations"
    ADD CONSTRAINT "print_stations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."restaurant_staff_accounts"
    ADD CONSTRAINT "restaurant_staff_accounts_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."restaurant_staff_accounts"
    ADD CONSTRAINT "restaurant_staff_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."restaurant_staff_accounts"
    ADD CONSTRAINT "restaurant_staff_accounts_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."restaurant_tables"
    ADD CONSTRAINT "restaurant_tables_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."restaurants"
    ADD CONSTRAINT "restaurants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."restaurants"
    ADD CONSTRAINT "restaurants_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."table_sessions"
    ADD CONSTRAINT "table_sessions_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_bill_splits_restaurant" ON "public"."bill_splits" USING "btree" ("restaurant_id");



CREATE INDEX "idx_bill_splits_session" ON "public"."bill_splits" USING "btree" ("session_id");



CREATE INDEX "idx_buffet_price_rules_lookup" ON "public"."buffet_price_rules" USING "btree" ("restaurant_id", "buffet_id", "time_slot_id", "calendar_kind") WHERE ("is_active" = true);



CREATE INDEX "idx_buffet_time_slots_restaurant" ON "public"."buffet_time_slots" USING "btree" ("restaurant_id");



CREATE INDEX "idx_buffets_restaurant" ON "public"."buffets" USING "btree" ("restaurant_id");



CREATE INDEX "idx_dish_feedback_restaurant_created" ON "public"."dish_feedback" USING "btree" ("restaurant_id", "created_at" DESC);



CREATE INDEX "idx_dish_feedback_vote" ON "public"."dish_feedback" USING "btree" ("restaurant_id", "vote");



CREATE INDEX "idx_feedback_sessions_restaurant_created" ON "public"."feedback_sessions" USING "btree" ("restaurant_id", "created_at" DESC);



CREATE UNIQUE INDEX "idx_menu_categories_code_per_parent" ON "public"."menu_categories" USING "btree" ("restaurant_id", COALESCE("parent_id", '00000000-0000-0000-0000-000000000000'::"uuid"), "lower"("btrim"(("item_code")::"text"))) WHERE (("item_code" IS NOT NULL) AND ("btrim"(("item_code")::"text") <> ''::"text"));



CREATE INDEX "idx_menu_categories_print_station" ON "public"."menu_categories" USING "btree" ("print_station_id") WHERE ("print_station_id" IS NOT NULL);



CREATE INDEX "idx_menu_categories_restaurant" ON "public"."menu_categories" USING "btree" ("restaurant_id", "parent_id", "sort_order");



CREATE INDEX "idx_menu_items_category" ON "public"."menu_items" USING "btree" ("restaurant_id", "category");



CREATE INDEX "idx_menu_items_category_id" ON "public"."menu_items" USING "btree" ("restaurant_id", "category_id");



CREATE UNIQUE INDEX "idx_menu_items_code_per_restaurant" ON "public"."menu_items" USING "btree" ("restaurant_id", "lower"("btrim"(("item_code")::"text"))) WHERE (("item_code" IS NOT NULL) AND ("btrim"(("item_code")::"text") <> ''::"text"));



CREATE INDEX "idx_menu_items_note_preset_keys" ON "public"."menu_items" USING "gin" ("note_preset_keys");



CREATE INDEX "idx_menu_items_print_station" ON "public"."menu_items" USING "btree" ("restaurant_id", "print_station_id") WHERE ("print_station_id" IS NOT NULL);



CREATE INDEX "idx_menu_items_restaurant" ON "public"."menu_items" USING "btree" ("restaurant_id");



CREATE INDEX "idx_orders_restaurant" ON "public"."orders" USING "btree" ("restaurant_id");



CREATE INDEX "idx_orders_restaurant_table_id" ON "public"."orders" USING "btree" ("restaurant_id", "table_id");



CREATE INDEX "idx_orders_session" ON "public"."orders" USING "btree" ("session_id");



CREATE INDEX "idx_orders_status" ON "public"."orders" USING "btree" ("restaurant_id", "status");



CREATE INDEX "idx_print_agent_devices_restaurant" ON "public"."print_agent_devices" USING "btree" ("restaurant_id");



CREATE INDEX "idx_print_agent_pairings_claim_lookup" ON "public"."print_agent_pairings" USING "btree" ("code") WHERE (("consumed_at" IS NULL) AND ("revoked_at" IS NULL));



CREATE INDEX "idx_print_agent_pairings_restaurant_expires" ON "public"."print_agent_pairings" USING "btree" ("restaurant_id", "expires_at" DESC);



CREATE INDEX "idx_print_agent_pairings_restaurant_pending" ON "public"."print_agent_pairings" USING "btree" ("restaurant_id", "expires_at" DESC) WHERE (("consumed_at" IS NULL) AND ("revoked_at" IS NULL));



CREATE INDEX "idx_print_jobs_restaurant_status_created" ON "public"."print_jobs" USING "btree" ("restaurant_id", "status", "created_at" DESC);



CREATE INDEX "idx_print_jobs_restaurant_table_id" ON "public"."print_jobs" USING "btree" ("restaurant_id", "table_id", "created_at" DESC) WHERE ("table_id" IS NOT NULL);



CREATE INDEX "idx_print_stations_restaurant" ON "public"."print_stations" USING "btree" ("restaurant_id", "sort_order", "created_at");



CREATE INDEX "idx_restaurant_tables_restaurant_active" ON "public"."restaurant_tables" USING "btree" ("restaurant_id", "sort_order") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_table_sessions_merge_into" ON "public"."table_sessions" USING "btree" ("merge_into_session_id");



CREATE INDEX "idx_table_sessions_restaurant_table_id" ON "public"."table_sessions" USING "btree" ("restaurant_id", "table_id");



CREATE INDEX "idx_table_sessions_status" ON "public"."table_sessions" USING "btree" ("restaurant_id", "status");



CREATE INDEX "restaurant_staff_accounts_restaurant_id_idx" ON "public"."restaurant_staff_accounts" USING "btree" ("restaurant_id");



CREATE INDEX "restaurant_staff_accounts_user_id_idx" ON "public"."restaurant_staff_accounts" USING "btree" ("user_id");



CREATE UNIQUE INDEX "restaurant_tables_active_display_name_unique" ON "public"."restaurant_tables" USING "btree" ("restaurant_id", "display_name") WHERE ("deleted_at" IS NULL);



CREATE UNIQUE INDEX "uniq_active_table_session" ON "public"."table_sessions" USING "btree" ("restaurant_id", "table_id") WHERE ("status" = ANY (ARRAY['open'::"text", 'billing'::"text"]));



CREATE UNIQUE INDEX "uniq_dish_feedback_session_item" ON "public"."dish_feedback" USING "btree" ("session_id", "menu_item_id");



CREATE UNIQUE INDEX "uniq_feedback_session" ON "public"."feedback_sessions" USING "btree" ("session_id");



CREATE OR REPLACE TRIGGER "buffets_updated_at" BEFORE UPDATE ON "public"."buffets" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "dish_feedback_updated_at" BEFORE UPDATE ON "public"."dish_feedback" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "menu_categories_print_station_restaurant" BEFORE INSERT OR UPDATE OF "print_station_id", "restaurant_id" ON "public"."menu_categories" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_print_station_same_restaurant"();



CREATE OR REPLACE TRIGGER "menu_items_print_station_restaurant" BEFORE INSERT OR UPDATE OF "print_station_id", "restaurant_id" ON "public"."menu_items" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_print_station_same_restaurant"();



CREATE OR REPLACE TRIGGER "orders_updated_at" BEFORE UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "print_jobs_set_updated_at" BEFORE UPDATE ON "public"."print_jobs" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "restaurants_after_insert_seed_print_stations" AFTER INSERT ON "public"."restaurants" FOR EACH ROW EXECUTE FUNCTION "public"."seed_default_print_stations_for_restaurant"();



CREATE OR REPLACE TRIGGER "restaurants_after_insert_seed_restaurant_tables" AFTER INSERT ON "public"."restaurants" FOR EACH ROW EXECUTE FUNCTION "public"."seed_default_restaurant_tables_for_restaurant"();



ALTER TABLE ONLY "public"."bill_splits"
    ADD CONSTRAINT "bill_splits_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bill_splits"
    ADD CONSTRAINT "bill_splits_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."table_sessions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bill_splits"
    ADD CONSTRAINT "bill_splits_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "public"."restaurant_tables"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."buffet_calendar_overrides"
    ADD CONSTRAINT "buffet_calendar_overrides_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."buffet_price_rules"
    ADD CONSTRAINT "buffet_price_rules_buffet_id_fkey" FOREIGN KEY ("buffet_id") REFERENCES "public"."buffets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."buffet_price_rules"
    ADD CONSTRAINT "buffet_price_rules_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."buffet_price_rules"
    ADD CONSTRAINT "buffet_price_rules_time_slot_id_fkey" FOREIGN KEY ("time_slot_id") REFERENCES "public"."buffet_time_slots"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."buffet_time_slots"
    ADD CONSTRAINT "buffet_time_slots_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."buffets"
    ADD CONSTRAINT "buffets_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dish_feedback"
    ADD CONSTRAINT "dish_feedback_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dish_feedback"
    ADD CONSTRAINT "dish_feedback_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dish_feedback"
    ADD CONSTRAINT "dish_feedback_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dish_feedback"
    ADD CONSTRAINT "dish_feedback_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."table_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feedback_sessions"
    ADD CONSTRAINT "feedback_sessions_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feedback_sessions"
    ADD CONSTRAINT "feedback_sessions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."table_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."menu_categories"
    ADD CONSTRAINT "menu_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."menu_categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."menu_categories"
    ADD CONSTRAINT "menu_categories_print_station_id_fkey" FOREIGN KEY ("print_station_id") REFERENCES "public"."print_stations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."menu_categories"
    ADD CONSTRAINT "menu_categories_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."menu_items"
    ADD CONSTRAINT "menu_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."menu_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."menu_items"
    ADD CONSTRAINT "menu_items_print_station_id_fkey" FOREIGN KEY ("print_station_id") REFERENCES "public"."print_stations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."menu_items"
    ADD CONSTRAINT "menu_items_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."table_sessions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "public"."restaurant_tables"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."print_agent_devices"
    ADD CONSTRAINT "print_agent_devices_pairing_id_fkey" FOREIGN KEY ("pairing_id") REFERENCES "public"."print_agent_pairings"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."print_agent_devices"
    ADD CONSTRAINT "print_agent_devices_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."print_agent_pairings"
    ADD CONSTRAINT "print_agent_pairings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."print_agent_pairings"
    ADD CONSTRAINT "print_agent_pairings_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."print_jobs"
    ADD CONSTRAINT "print_jobs_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."print_stations"
    ADD CONSTRAINT "print_stations_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."restaurant_staff_accounts"
    ADD CONSTRAINT "restaurant_staff_accounts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."restaurant_staff_accounts"
    ADD CONSTRAINT "restaurant_staff_accounts_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."restaurant_staff_accounts"
    ADD CONSTRAINT "restaurant_staff_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."restaurant_tables"
    ADD CONSTRAINT "restaurant_tables_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."restaurants"
    ADD CONSTRAINT "restaurants_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."table_sessions"
    ADD CONSTRAINT "table_sessions_closed_by_user_id_fkey" FOREIGN KEY ("closed_by_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."table_sessions"
    ADD CONSTRAINT "table_sessions_merge_into_session_id_fkey" FOREIGN KEY ("merge_into_session_id") REFERENCES "public"."table_sessions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."table_sessions"
    ADD CONSTRAINT "table_sessions_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."table_sessions"
    ADD CONSTRAINT "table_sessions_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "public"."restaurant_tables"("id") ON DELETE RESTRICT;



ALTER TABLE "public"."bill_splits" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bill_splits_cashier_select" ON "public"."bill_splits" FOR SELECT TO "authenticated" USING ("public"."is_active_restaurant_staff"("restaurant_id", ARRAY['cashier'::"text"]));



CREATE POLICY "bill_splits_owner_select" ON "public"."bill_splits" FOR SELECT TO "authenticated" USING (("restaurant_id" IN ( SELECT "restaurants"."id"
   FROM "public"."restaurants"
  WHERE ("restaurants"."owner_id" = "auth"."uid"()))));



CREATE POLICY "bill_splits_owner_update" ON "public"."bill_splits" FOR UPDATE TO "authenticated" USING (("restaurant_id" IN ( SELECT "restaurants"."id"
   FROM "public"."restaurants"
  WHERE ("restaurants"."owner_id" = "auth"."uid"())))) WITH CHECK (("restaurant_id" IN ( SELECT "restaurants"."id"
   FROM "public"."restaurants"
  WHERE ("restaurants"."owner_id" = "auth"."uid"()))));



ALTER TABLE "public"."buffet_calendar_overrides" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "buffet_calendar_owner_delete" ON "public"."buffet_calendar_overrides" FOR DELETE USING (("restaurant_id" IN ( SELECT "restaurants"."id"
   FROM "public"."restaurants"
  WHERE ("restaurants"."owner_id" = "auth"."uid"()))));



CREATE POLICY "buffet_calendar_owner_insert" ON "public"."buffet_calendar_overrides" FOR INSERT WITH CHECK (("restaurant_id" IN ( SELECT "restaurants"."id"
   FROM "public"."restaurants"
  WHERE ("restaurants"."owner_id" = "auth"."uid"()))));



CREATE POLICY "buffet_calendar_owner_update" ON "public"."buffet_calendar_overrides" FOR UPDATE USING (("restaurant_id" IN ( SELECT "restaurants"."id"
   FROM "public"."restaurants"
  WHERE ("restaurants"."owner_id" = "auth"."uid"()))));



CREATE POLICY "buffet_calendar_public_read" ON "public"."buffet_calendar_overrides" FOR SELECT USING (true);



ALTER TABLE "public"."buffet_price_rules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "buffet_price_rules_owner_delete" ON "public"."buffet_price_rules" FOR DELETE USING (("restaurant_id" IN ( SELECT "restaurants"."id"
   FROM "public"."restaurants"
  WHERE ("restaurants"."owner_id" = "auth"."uid"()))));



CREATE POLICY "buffet_price_rules_owner_insert" ON "public"."buffet_price_rules" FOR INSERT WITH CHECK (("restaurant_id" IN ( SELECT "restaurants"."id"
   FROM "public"."restaurants"
  WHERE ("restaurants"."owner_id" = "auth"."uid"()))));



CREATE POLICY "buffet_price_rules_owner_update" ON "public"."buffet_price_rules" FOR UPDATE USING (("restaurant_id" IN ( SELECT "restaurants"."id"
   FROM "public"."restaurants"
  WHERE ("restaurants"."owner_id" = "auth"."uid"()))));



CREATE POLICY "buffet_price_rules_public_read" ON "public"."buffet_price_rules" FOR SELECT USING (true);



ALTER TABLE "public"."buffet_time_slots" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "buffet_time_slots_owner_delete" ON "public"."buffet_time_slots" FOR DELETE USING (("restaurant_id" IN ( SELECT "restaurants"."id"
   FROM "public"."restaurants"
  WHERE ("restaurants"."owner_id" = "auth"."uid"()))));



CREATE POLICY "buffet_time_slots_owner_insert" ON "public"."buffet_time_slots" FOR INSERT WITH CHECK (("restaurant_id" IN ( SELECT "restaurants"."id"
   FROM "public"."restaurants"
  WHERE ("restaurants"."owner_id" = "auth"."uid"()))));



CREATE POLICY "buffet_time_slots_owner_update" ON "public"."buffet_time_slots" FOR UPDATE USING (("restaurant_id" IN ( SELECT "restaurants"."id"
   FROM "public"."restaurants"
  WHERE ("restaurants"."owner_id" = "auth"."uid"()))));



CREATE POLICY "buffet_time_slots_public_read" ON "public"."buffet_time_slots" FOR SELECT USING (true);



ALTER TABLE "public"."buffets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "buffets_owner_delete" ON "public"."buffets" FOR DELETE USING (("restaurant_id" IN ( SELECT "restaurants"."id"
   FROM "public"."restaurants"
  WHERE ("restaurants"."owner_id" = "auth"."uid"()))));



CREATE POLICY "buffets_owner_insert" ON "public"."buffets" FOR INSERT WITH CHECK (("restaurant_id" IN ( SELECT "restaurants"."id"
   FROM "public"."restaurants"
  WHERE ("restaurants"."owner_id" = "auth"."uid"()))));



CREATE POLICY "buffets_owner_update" ON "public"."buffets" FOR UPDATE USING (("restaurant_id" IN ( SELECT "restaurants"."id"
   FROM "public"."restaurants"
  WHERE ("restaurants"."owner_id" = "auth"."uid"()))));



CREATE POLICY "buffets_public_read" ON "public"."buffets" FOR SELECT USING (true);



ALTER TABLE "public"."dish_feedback" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "dish_feedback_public_all" ON "public"."dish_feedback" USING (true) WITH CHECK (true);



ALTER TABLE "public"."feedback_sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "feedback_sessions_public_all" ON "public"."feedback_sessions" USING (true) WITH CHECK (true);



ALTER TABLE "public"."menu_categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "menu_categories_owner_all" ON "public"."menu_categories" USING (("restaurant_id" IN ( SELECT "restaurants"."id"
   FROM "public"."restaurants"
  WHERE ("restaurants"."owner_id" = "auth"."uid"()))));



CREATE POLICY "menu_categories_public_read" ON "public"."menu_categories" FOR SELECT USING (true);



ALTER TABLE "public"."menu_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "menu_items_owner_all" ON "public"."menu_items" USING (("restaurant_id" IN ( SELECT "restaurants"."id"
   FROM "public"."restaurants"
  WHERE ("restaurants"."owner_id" = "auth"."uid"()))));



CREATE POLICY "menu_items_public_read" ON "public"."menu_items" FOR SELECT USING (true);



ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "orders_cashier_select" ON "public"."orders" FOR SELECT TO "authenticated" USING ("public"."is_active_restaurant_staff"("restaurant_id", ARRAY['cashier'::"text"]));



CREATE POLICY "orders_owner_select" ON "public"."orders" FOR SELECT TO "authenticated" USING (("restaurant_id" IN ( SELECT "restaurants"."id"
   FROM "public"."restaurants"
  WHERE ("restaurants"."owner_id" = "auth"."uid"()))));



CREATE POLICY "orders_owner_update" ON "public"."orders" FOR UPDATE USING (("restaurant_id" IN ( SELECT "restaurants"."id"
   FROM "public"."restaurants"
  WHERE ("restaurants"."owner_id" = "auth"."uid"()))));



CREATE POLICY "orders_public_insert" ON "public"."orders" FOR INSERT WITH CHECK (true);



CREATE POLICY "orders_staff_select" ON "public"."orders" FOR SELECT TO "authenticated" USING ("public"."is_active_restaurant_staff"("restaurant_id"));



CREATE POLICY "orders_staff_update" ON "public"."orders" FOR UPDATE TO "authenticated" USING ("public"."is_active_restaurant_staff"("restaurant_id", ARRAY['kitchen'::"text", 'waiter'::"text"])) WITH CHECK ("public"."is_active_restaurant_staff"("restaurant_id", ARRAY['kitchen'::"text", 'waiter'::"text"]));



ALTER TABLE "public"."print_agent_devices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "print_agent_devices_owner_select" ON "public"."print_agent_devices" FOR SELECT USING (("restaurant_id" IN ( SELECT "restaurants"."id"
   FROM "public"."restaurants"
  WHERE ("restaurants"."owner_id" = "auth"."uid"()))));



ALTER TABLE "public"."print_agent_pairings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "print_agent_pairings_owner_insert" ON "public"."print_agent_pairings" FOR INSERT WITH CHECK (("restaurant_id" IN ( SELECT "restaurants"."id"
   FROM "public"."restaurants"
  WHERE ("restaurants"."owner_id" = "auth"."uid"()))));



CREATE POLICY "print_agent_pairings_owner_select" ON "public"."print_agent_pairings" FOR SELECT USING (("restaurant_id" IN ( SELECT "restaurants"."id"
   FROM "public"."restaurants"
  WHERE ("restaurants"."owner_id" = "auth"."uid"()))));



CREATE POLICY "print_agent_pairings_owner_update" ON "public"."print_agent_pairings" FOR UPDATE USING (("restaurant_id" IN ( SELECT "restaurants"."id"
   FROM "public"."restaurants"
  WHERE ("restaurants"."owner_id" = "auth"."uid"()))));



ALTER TABLE "public"."print_jobs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "print_jobs_owner_delete" ON "public"."print_jobs" FOR DELETE USING (("restaurant_id" IN ( SELECT "restaurants"."id"
   FROM "public"."restaurants"
  WHERE ("restaurants"."owner_id" = "auth"."uid"()))));



CREATE POLICY "print_jobs_owner_insert" ON "public"."print_jobs" FOR INSERT WITH CHECK (("restaurant_id" IN ( SELECT "restaurants"."id"
   FROM "public"."restaurants"
  WHERE ("restaurants"."owner_id" = "auth"."uid"()))));



CREATE POLICY "print_jobs_owner_select" ON "public"."print_jobs" FOR SELECT USING (("restaurant_id" IN ( SELECT "restaurants"."id"
   FROM "public"."restaurants"
  WHERE ("restaurants"."owner_id" = "auth"."uid"()))));



CREATE POLICY "print_jobs_owner_update" ON "public"."print_jobs" FOR UPDATE USING (("restaurant_id" IN ( SELECT "restaurants"."id"
   FROM "public"."restaurants"
  WHERE ("restaurants"."owner_id" = "auth"."uid"()))));



ALTER TABLE "public"."print_stations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "print_stations_owner_all" ON "public"."print_stations" USING (("restaurant_id" IN ( SELECT "restaurants"."id"
   FROM "public"."restaurants"
  WHERE ("restaurants"."owner_id" = "auth"."uid"()))));



CREATE POLICY "print_stations_public_read" ON "public"."print_stations" FOR SELECT USING (true);



ALTER TABLE "public"."restaurant_staff_accounts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "restaurant_staff_accounts_owner_all" ON "public"."restaurant_staff_accounts" TO "authenticated" USING (("restaurant_id" IN ( SELECT "public"."auth_owned_restaurant_ids"() AS "auth_owned_restaurant_ids"))) WITH CHECK (("restaurant_id" IN ( SELECT "public"."auth_owned_restaurant_ids"() AS "auth_owned_restaurant_ids")));



CREATE POLICY "restaurant_staff_accounts_staff_select_own" ON "public"."restaurant_staff_accounts" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) AND ("disabled_at" IS NULL)));



ALTER TABLE "public"."restaurant_tables" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "restaurant_tables_owner_all" ON "public"."restaurant_tables" USING (("restaurant_id" IN ( SELECT "restaurants"."id"
   FROM "public"."restaurants"
  WHERE ("restaurants"."owner_id" = "auth"."uid"()))));



CREATE POLICY "restaurant_tables_staff_select" ON "public"."restaurant_tables" FOR SELECT TO "authenticated" USING ((("deleted_at" IS NULL) AND "public"."is_active_restaurant_staff"("restaurant_id", ARRAY['kitchen'::"text", 'waiter'::"text", 'cashier'::"text"])));



ALTER TABLE "public"."restaurants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "restaurants_delete_own" ON "public"."restaurants" FOR DELETE USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "restaurants_insert_own" ON "public"."restaurants" FOR INSERT WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "restaurants_select_own" ON "public"."restaurants" FOR SELECT USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "restaurants_staff_select_own" ON "public"."restaurants" FOR SELECT TO "authenticated" USING (("id" IN ( SELECT "public"."auth_staff_restaurant_ids"() AS "auth_staff_restaurant_ids")));



CREATE POLICY "restaurants_update_own" ON "public"."restaurants" FOR UPDATE USING (("owner_id" = "auth"."uid"()));



ALTER TABLE "public"."table_sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "table_sessions_owner_select" ON "public"."table_sessions" FOR SELECT TO "authenticated" USING (("restaurant_id" IN ( SELECT "restaurants"."id"
   FROM "public"."restaurants"
  WHERE ("restaurants"."owner_id" = "auth"."uid"()))));



CREATE POLICY "table_sessions_owner_update" ON "public"."table_sessions" FOR UPDATE TO "authenticated" USING (("restaurant_id" IN ( SELECT "restaurants"."id"
   FROM "public"."restaurants"
  WHERE ("restaurants"."owner_id" = "auth"."uid"())))) WITH CHECK (("restaurant_id" IN ( SELECT "restaurants"."id"
   FROM "public"."restaurants"
  WHERE ("restaurants"."owner_id" = "auth"."uid"()))));



CREATE POLICY "table_sessions_staff_select" ON "public"."table_sessions" FOR SELECT TO "authenticated" USING ("public"."is_active_restaurant_staff"("restaurant_id"));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."bill_splits";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."buffet_calendar_overrides";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."buffet_price_rules";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."buffet_time_slots";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."buffets";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."orders";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."print_jobs";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."table_sessions";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































REVOKE ALL ON FUNCTION "public"."auth_owned_restaurant_ids"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."auth_owned_restaurant_ids"() TO "anon";
GRANT ALL ON FUNCTION "public"."auth_owned_restaurant_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auth_owned_restaurant_ids"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."auth_staff_restaurant_ids"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."auth_staff_restaurant_ids"() TO "anon";
GRANT ALL ON FUNCTION "public"."auth_staff_restaurant_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auth_staff_restaurant_ids"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."confirm_bill_split_payment"("p_restaurant_id" "uuid", "p_bill_split_id" "uuid", "p_person_index" integer, "p_discount_rate" numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."confirm_bill_split_payment"("p_restaurant_id" "uuid", "p_bill_split_id" "uuid", "p_person_index" integer, "p_discount_rate" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."confirm_bill_split_payment"("p_restaurant_id" "uuid", "p_bill_split_id" "uuid", "p_person_index" integer, "p_discount_rate" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_print_station_same_restaurant"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_print_station_same_restaurant"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_print_station_same_restaurant"() TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."restaurant_tables" TO "anon";
GRANT ALL ON TABLE "public"."restaurant_tables" TO "authenticated";
GRANT ALL ON TABLE "public"."restaurant_tables" TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_active_restaurant_table"("p_restaurant_id" "uuid", "p_table_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_active_restaurant_table"("p_restaurant_id" "uuid", "p_table_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_active_restaurant_table"("p_restaurant_id" "uuid", "p_table_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_active_restaurant_table"("p_restaurant_id" "uuid", "p_table_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_active_restaurant_staff"("p_restaurant_id" "uuid", "p_roles" "text"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_active_restaurant_staff"("p_restaurant_id" "uuid", "p_roles" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."is_active_restaurant_staff"("p_restaurant_id" "uuid", "p_roles" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_active_restaurant_staff"("p_restaurant_id" "uuid", "p_roles" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."merge_multiple_table_sessions"("p_restaurant_id" "uuid", "p_source_table_ids" "uuid"[], "p_target_table_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."merge_multiple_table_sessions"("p_restaurant_id" "uuid", "p_source_table_ids" "uuid"[], "p_target_table_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."merge_table_sessions"("p_restaurant_id" "uuid", "p_source_table_id" "uuid", "p_target_table_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."merge_table_sessions"("p_restaurant_id" "uuid", "p_source_table_id" "uuid", "p_target_table_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."recalc_order_total_from_items"("p_items" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."recalc_order_total_from_items"("p_items" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."recalc_order_total_from_items"("p_items" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."resolve_buffet_prices"("p_restaurant_id" "uuid", "p_buffet_id" "uuid", "p_at" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."resolve_buffet_prices"("p_restaurant_id" "uuid", "p_buffet_id" "uuid", "p_at" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."resolve_buffet_prices"("p_restaurant_id" "uuid", "p_buffet_id" "uuid", "p_at" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."seed_default_print_stations_for_restaurant"() TO "anon";
GRANT ALL ON FUNCTION "public"."seed_default_print_stations_for_restaurant"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."seed_default_print_stations_for_restaurant"() TO "service_role";



GRANT ALL ON FUNCTION "public"."seed_default_restaurant_tables_for_restaurant"() TO "anon";
GRANT ALL ON FUNCTION "public"."seed_default_restaurant_tables_for_restaurant"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."seed_default_restaurant_tables_for_restaurant"() TO "service_role";



GRANT ALL ON FUNCTION "public"."transfer_table_session"("p_restaurant_id" "uuid", "p_from_table_id" "uuid", "p_to_table_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."transfer_table_session"("p_restaurant_id" "uuid", "p_from_table_id" "uuid", "p_to_table_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."void_active_buffet_lines_in_items"("p_items" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."void_active_buffet_lines_in_items"("p_items" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."void_active_buffet_lines_in_items"("p_items" "jsonb") TO "service_role";


















GRANT ALL ON TABLE "public"."bill_splits" TO "anon";
GRANT ALL ON TABLE "public"."bill_splits" TO "authenticated";
GRANT ALL ON TABLE "public"."bill_splits" TO "service_role";



GRANT ALL ON TABLE "public"."buffet_calendar_overrides" TO "anon";
GRANT ALL ON TABLE "public"."buffet_calendar_overrides" TO "authenticated";
GRANT ALL ON TABLE "public"."buffet_calendar_overrides" TO "service_role";



GRANT ALL ON TABLE "public"."buffet_price_rules" TO "anon";
GRANT ALL ON TABLE "public"."buffet_price_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."buffet_price_rules" TO "service_role";



GRANT ALL ON TABLE "public"."buffet_time_slots" TO "anon";
GRANT ALL ON TABLE "public"."buffet_time_slots" TO "authenticated";
GRANT ALL ON TABLE "public"."buffet_time_slots" TO "service_role";



GRANT ALL ON TABLE "public"."buffets" TO "anon";
GRANT ALL ON TABLE "public"."buffets" TO "authenticated";
GRANT ALL ON TABLE "public"."buffets" TO "service_role";



GRANT ALL ON TABLE "public"."dish_feedback" TO "anon";
GRANT ALL ON TABLE "public"."dish_feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."dish_feedback" TO "service_role";



GRANT ALL ON TABLE "public"."feedback_sessions" TO "anon";
GRANT ALL ON TABLE "public"."feedback_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."feedback_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."menu_categories" TO "anon";
GRANT ALL ON TABLE "public"."menu_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."menu_categories" TO "service_role";



GRANT ALL ON TABLE "public"."menu_items" TO "anon";
GRANT ALL ON TABLE "public"."menu_items" TO "authenticated";
GRANT ALL ON TABLE "public"."menu_items" TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON TABLE "public"."print_agent_devices" TO "anon";
GRANT ALL ON TABLE "public"."print_agent_devices" TO "authenticated";
GRANT ALL ON TABLE "public"."print_agent_devices" TO "service_role";



GRANT ALL ON TABLE "public"."print_agent_pairings" TO "anon";
GRANT ALL ON TABLE "public"."print_agent_pairings" TO "authenticated";
GRANT ALL ON TABLE "public"."print_agent_pairings" TO "service_role";



GRANT ALL ON TABLE "public"."print_jobs" TO "anon";
GRANT ALL ON TABLE "public"."print_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."print_jobs" TO "service_role";



GRANT ALL ON TABLE "public"."print_stations" TO "anon";
GRANT ALL ON TABLE "public"."print_stations" TO "authenticated";
GRANT ALL ON TABLE "public"."print_stations" TO "service_role";



GRANT ALL ON TABLE "public"."restaurant_staff_accounts" TO "anon";
GRANT ALL ON TABLE "public"."restaurant_staff_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."restaurant_staff_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."restaurants" TO "anon";
GRANT ALL ON TABLE "public"."restaurants" TO "authenticated";
GRANT ALL ON TABLE "public"."restaurants" TO "service_role";



GRANT ALL ON TABLE "public"."restaurants_public" TO "anon";
GRANT ALL ON TABLE "public"."restaurants_public" TO "authenticated";
GRANT ALL ON TABLE "public"."restaurants_public" TO "service_role";



GRANT ALL ON TABLE "public"."table_sessions" TO "anon";
GRANT ALL ON TABLE "public"."table_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."table_sessions" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";




































-- ============================================================
-- Storage: menu item images (public read, owner write)
-- Path: {restaurant_id}/{menu_item_id}.{ext}
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'menu-images',
  'menu-images',
  true,
  1048576,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "menu_images_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'menu-images');

CREATE POLICY "menu_images_owner_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'menu-images'
    AND split_part(name, '/', 1) IN (
      SELECT id::text FROM public.restaurants WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "menu_images_owner_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'menu-images'
    AND split_part(name, '/', 1) IN (
      SELECT id::text FROM public.restaurants WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'menu-images'
    AND split_part(name, '/', 1) IN (
      SELECT id::text FROM public.restaurants WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "menu_images_owner_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'menu-images'
    AND split_part(name, '/', 1) IN (
      SELECT id::text FROM public.restaurants WHERE owner_id = auth.uid()
    )
  );
