-- Standing buffet prices: valid_to NULL = open-ended (no silent yearly expiry).
-- Batch-clear existing end dates (migration is not a staff operation_log).
-- resolve_buffet_prices: date >= valid_from AND (valid_to IS NULL OR date <= valid_to).

ALTER TABLE public.buffet_price_rules
  ALTER COLUMN valid_to DROP NOT NULL;

ALTER TABLE public.buffet_price_rules
  DROP CONSTRAINT IF EXISTS buffet_price_rules_valid_range;

ALTER TABLE public.buffet_price_rules
  ADD CONSTRAINT buffet_price_rules_valid_range
  CHECK (valid_to IS NULL OR valid_to >= valid_from);

UPDATE public.buffet_price_rules
SET valid_to = NULL
WHERE valid_to IS NOT NULL;

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
