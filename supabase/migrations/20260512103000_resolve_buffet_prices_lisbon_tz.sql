-- Buffet price resolution used UTC for date/time/weekday; slots are configured in local
-- restaurant hours. Use Europe/Lisbon as the business timezone for matching slots and
-- calendar overrides (Portuguese restaurants).

create or replace function public.resolve_buffet_prices(
  p_restaurant_id uuid,
  p_buffet_id uuid,
  p_at timestamptz default now()
)
returns table (
  adult_price numeric,
  child_price numeric,
  rule_id uuid,
  time_slot_id uuid
)
language plpgsql
stable
as $$
declare
  v_tz text := 'Europe/Lisbon';
  v_date date;
  v_t time;
  v_dow int;
  v_override text;
  v_cal text;
  v_slot_id uuid;
begin
  v_date := (p_at at time zone v_tz)::date;
  v_t := (p_at at time zone v_tz)::time;
  v_dow := extract(dow from (p_at at time zone v_tz))::int;

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

  select ts.id into v_slot_id
  from public.buffet_time_slots ts
  where ts.restaurant_id = p_restaurant_id
    and v_dow = any (ts.weekdays)
    and (
      (ts.start_time <= ts.end_time and v_t >= ts.start_time and v_t < ts.end_time)
      or (ts.start_time > ts.end_time and (v_t >= ts.start_time or v_t < ts.end_time))
    )
  order by ts.sort_order asc, ts.name asc
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

grant execute on function public.resolve_buffet_prices(uuid, uuid, timestamptz) to anon, authenticated;
