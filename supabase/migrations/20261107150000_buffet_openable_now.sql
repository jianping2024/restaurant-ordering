-- 可开台时段：只有「当前时段 + 今天日历类型」下有生效价格规则的启用套餐才能开台 / 换成它。
-- 当前时段 = 全店当天（星期）所有时段里离现在最近的那个（同 lib/menu-time-slot resolveMenuTimeSlotId）。
-- 从 resolve_buffet_prices 抽出两段共用逻辑，价格计算行为不变：
--   buffet_slot_distance_seconds（时段离现在多远）、buffet_calendar_kind（今天的日历类型）。

-- Seconds from wall time p_at to the slot window [start, end) (0 inside; wrap slot outside = 1 day).
CREATE OR REPLACE FUNCTION public.buffet_slot_distance_seconds(
  p_start time,
  p_end time,
  p_at time
)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_start <= p_end AND p_at >= p_start AND p_at < p_end
      THEN 0::double precision
    WHEN p_start > p_end AND (p_at >= p_start OR p_at < p_end)
      THEN 0::double precision
    WHEN p_start <= p_end AND p_at < p_start
      THEN extract(epoch FROM (p_start - p_at))
    WHEN p_start <= p_end AND p_at >= p_end
      THEN extract(epoch FROM (p_at - p_end))
    ELSE 86400::double precision
  END;
$$;

-- Lisbon calendar kind at p_at: holiday | special override, weekend (Sat/Sun, or Friday at/after
-- restaurants.buffet_friday_weekend_from), else weekday.
CREATE OR REPLACE FUNCTION public.buffet_calendar_kind(
  p_restaurant_id uuid,
  p_at timestamptz
)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_tz text := 'Europe/Lisbon';
  v_date date := (p_at AT TIME ZONE v_tz)::date;
  v_t time := (p_at AT TIME ZONE v_tz)::time;
  v_dow int := extract(dow FROM (p_at AT TIME ZONE v_tz))::int;
  v_override text;
  v_friday_from time;
BEGIN
  SELECT r.buffet_friday_weekend_from INTO v_friday_from
  FROM public.restaurants r
  WHERE r.id = p_restaurant_id;

  SELECT bco.kind INTO v_override
  FROM public.buffet_calendar_overrides bco
  WHERE bco.restaurant_id = p_restaurant_id
    AND bco.on_date = v_date;

  IF v_override = 'holiday' THEN
    RETURN 'holiday';
  ELSIF v_override = 'special' THEN
    RETURN 'special';
  ELSIF v_dow IN (0, 6) THEN
    RETURN 'weekend';
  ELSIF v_dow = 5 AND v_friday_from IS NOT NULL AND v_t >= v_friday_from THEN
    RETURN 'weekend';
  END IF;
  RETURN 'weekday';
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_buffet_prices(
  p_restaurant_id uuid,
  p_buffet_id uuid,
  p_at timestamp with time zone DEFAULT now()
)
RETURNS TABLE(adult_price numeric, child_price numeric, rule_id uuid, time_slot_id uuid)
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
    and v_date >= r.valid_from
    and (r.valid_to is null or v_date <= r.valid_to)
  order by r.priority desc, r.valid_from desc
  limit 1;
end;
$function$;

-- Sole「可开台」: active buffets with an active, in-date rule in the store's current slot
-- (nearest of all today's slots) for today's calendar kind. Cold open and buffet switch only.
CREATE OR REPLACE FUNCTION public.buffet_openable_ids(
  p_restaurant_id uuid,
  p_at timestamptz DEFAULT now()
)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH local AS (
    SELECT
      (p_at AT TIME ZONE 'Europe/Lisbon')::date AS d,
      (p_at AT TIME ZONE 'Europe/Lisbon')::time AS t,
      extract(dow FROM (p_at AT TIME ZONE 'Europe/Lisbon'))::int AS dow,
      public.buffet_calendar_kind(p_restaurant_id, p_at) AS cal
  ),
  current_slot AS (
    SELECT ts.id
    FROM public.buffet_time_slots ts, local
    WHERE ts.restaurant_id = p_restaurant_id
      AND local.dow = ANY (ts.weekdays)
    ORDER BY public.buffet_slot_distance_seconds(ts.start_time, ts.end_time, local.t) ASC,
      ts.sort_order ASC,
      ts.name ASC
    LIMIT 1
  )
  SELECT b.id
  FROM public.buffets b, local, current_slot
  WHERE b.restaurant_id = p_restaurant_id
    AND b.is_active
    AND EXISTS (
      SELECT 1
      FROM public.buffet_price_rules r
      WHERE r.restaurant_id = p_restaurant_id
        AND r.buffet_id = b.id
        AND r.time_slot_id = current_slot.id
        AND r.calendar_kind = local.cal
        AND r.is_active
        AND local.d >= r.valid_from
        AND (r.valid_to IS NULL OR local.d <= r.valid_to)
    );
$$;

REVOKE ALL ON FUNCTION public.buffet_openable_ids(uuid, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.buffet_openable_ids(uuid, timestamptz) TO authenticated, service_role;
