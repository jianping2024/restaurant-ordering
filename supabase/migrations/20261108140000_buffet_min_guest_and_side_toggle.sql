-- 套餐最少人数 + 价格规则成人/儿童开关（docs/buffet-min-guest-and-side-toggle.zh.md）。
-- 最少人数只存 buffets.min_guest_count；开关只存 buffet_price_rules.adult_enabled/child_enabled，
-- 经 resolve_buffet_prices 随取价结果返回。价格列保持 NOT NULL（关掉的一侧保留原价），
-- merge_table_sessions 的「两价都不能为空」不受影响。

ALTER TABLE public.buffets
  ADD COLUMN IF NOT EXISTS min_guest_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.buffets
  DROP CONSTRAINT IF EXISTS buffets_min_guest_count_range;
ALTER TABLE public.buffets
  ADD CONSTRAINT buffets_min_guest_count_range CHECK (min_guest_count BETWEEN 0 AND 99);

COMMENT ON COLUMN public.buffets.min_guest_count IS
  'Minimum adults+children headcount to open / keep this buffet on a table (0 = no minimum).';

ALTER TABLE public.buffet_price_rules
  ADD COLUMN IF NOT EXISTS adult_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS child_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE public.buffet_price_rules
  DROP CONSTRAINT IF EXISTS buffet_price_rules_side_enabled;
ALTER TABLE public.buffet_price_rules
  ADD CONSTRAINT buffet_price_rules_side_enabled CHECK (adult_enabled OR child_enabled);

COMMENT ON COLUMN public.buffet_price_rules.adult_enabled IS
  'Whether this rule sells adult seats; disabled side headcount must be 0 (price kept, not shown).';
COMMENT ON COLUMN public.buffet_price_rules.child_enabled IS
  'Whether this rule sells child seats; disabled side headcount must be 0 (price kept, not shown).';

-- Return type changes → DROP + recreate (same body as 20261107150000, two extra columns).
DROP FUNCTION IF EXISTS public.resolve_buffet_prices(uuid, uuid, timestamptz);

CREATE FUNCTION public.resolve_buffet_prices(
  p_restaurant_id uuid,
  p_buffet_id uuid,
  p_at timestamp with time zone DEFAULT now()
)
RETURNS TABLE(
  adult_price numeric,
  child_price numeric,
  rule_id uuid,
  time_slot_id uuid,
  adult_enabled boolean,
  child_enabled boolean
)
LANGUAGE plpgsql
STABLE
AS $function$
declare
  v_tz text := 'Europe/Lisbon';
  v_date date;
  v_t time;
  v_dow int;
  v_cal text;
  v_slot_id uuid;
begin
  v_date := (p_at at time zone v_tz)::date;
  v_t := (p_at at time zone v_tz)::time;
  v_dow := extract(dow from (p_at at time zone v_tz))::int;
  v_cal := public.buffet_calendar_kind(p_restaurant_id, p_at);

  select s.id into v_slot_id
  from (
    select
      ts.id,
      public.buffet_slot_distance_seconds(ts.start_time, ts.end_time, v_t) as dist,
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
          and v_date >= r.valid_from
          and (r.valid_to is null or v_date <= r.valid_to)
      )
  ) s
  order by s.dist asc, s.sort_order asc, s.name asc
  limit 1;

  if v_slot_id is null then
    return query select null::numeric, null::numeric, null::uuid, null::uuid, null::boolean, null::boolean;
    return;
  end if;

  return query
  select r.adult_price, r.child_price, r.id, r.time_slot_id, r.adult_enabled, r.child_enabled
  from public.buffet_price_rules r
  where r.restaurant_id = p_restaurant_id
    and r.buffet_id = p_buffet_id
    and r.time_slot_id = v_slot_id
    and r.calendar_kind = v_cal
    and r.is_active
    and v_date >= r.valid_from
    and (r.valid_to is null or v_date <= r.valid_to)
  order by r.priority desc, r.valid_from desc
  limit 1;
end;
$function$;
