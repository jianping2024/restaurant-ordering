-- Sole order-append merge/insert under session lock + order row FOR UPDATE.
-- Fixes lost updates when multiple guests append into the same orders.items jsonb concurrently.
-- Mirrors confirm_bill_split_payment / merge_table_sessions locking style.

create or replace function public.append_order_items(
  p_restaurant_id uuid,
  p_session_id uuid,
  p_table_id uuid,
  p_display_name text,
  p_new_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_order public.orders%rowtype;
  v_prior jsonb;
  v_merged jsonb;
  v_elem jsonb;
  v_had_done_before boolean := false;
  v_is_first_order boolean := false;
  v_total numeric := 0;
  v_status text := 'pending';
  v_kitchen_count int := 0;
  v_kitchen_voided int := 0;
  v_kitchen_done_or_voided int := 0;
  v_has_buffet boolean := false;
  v_item_status text;
  v_kind text;
  v_price numeric;
  v_qty numeric;
  v_new_id uuid;
begin
  if p_restaurant_id is null or p_session_id is null or p_table_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_args');
  end if;

  if p_new_items is null or jsonb_typeof(p_new_items) <> 'array' or jsonb_array_length(p_new_items) < 1 then
    return jsonb_build_object('ok', false, 'code', 'invalid_items');
  end if;

  -- Serialize all appends for this session (merge target + first-insert race).
  perform pg_advisory_xact_lock(hashtext(p_session_id::text));

  select *
    into v_order
  from public.orders
  where restaurant_id = p_restaurant_id
    and session_id = p_session_id
    and status in ('pending', 'cooking', 'done')
  order by created_at desc nulls last
  limit 1
  for update;

  if found then
    v_prior := coalesce(v_order.items, '[]'::jsonb);
    if jsonb_typeof(v_prior) <> 'array' then
      v_prior := '[]'::jsonb;
    end if;

    v_had_done_before := (
      jsonb_array_length(v_prior) > 0
      and not exists (
        select 1
        from jsonb_array_elements(v_prior) e
        where coalesce(e->>'item_status', 'pending') is distinct from 'done'
      )
    );

    v_merged := v_prior || p_new_items;
    v_is_first_order := false;
  else
    v_prior := '[]'::jsonb;
    v_merged := p_new_items;
    v_had_done_before := false;
    v_is_first_order := true;
  end if;

  -- total_amount: sum price*qty for non-voided (qty falls back to quantity).
  for v_elem in select value from jsonb_array_elements(v_merged)
  loop
    v_item_status := coalesce(v_elem->>'item_status', 'pending');
    if v_item_status = 'voided' then
      continue;
    end if;
    begin
      v_price := coalesce((v_elem->>'price')::numeric, 0);
    exception when others then
      v_price := 0;
    end;
    begin
      if v_elem ? 'qty' and nullif(v_elem->>'qty', '') is not null then
        v_qty := (v_elem->>'qty')::numeric;
      elsif v_elem ? 'quantity' and nullif(v_elem->>'quantity', '') is not null then
        v_qty := (v_elem->>'quantity')::numeric;
      else
        v_qty := 0;
      end if;
    exception when others then
      v_qty := 0;
    end;
    v_total := v_total + (v_price * v_qty);
  end loop;

  -- status: mirror deriveOrderStatusFromItems (kitchen = not buffet_base).
  for v_elem in select value from jsonb_array_elements(v_merged)
  loop
    v_kind := coalesce(v_elem->>'kind', '');
    if v_kind = 'buffet_base' then
      v_has_buffet := true;
      continue;
    end if;
    v_kitchen_count := v_kitchen_count + 1;
    v_item_status := coalesce(v_elem->>'item_status', 'pending');
    if v_item_status = 'voided' then
      v_kitchen_voided := v_kitchen_voided + 1;
      v_kitchen_done_or_voided := v_kitchen_done_or_voided + 1;
    elsif v_item_status = 'done' then
      v_kitchen_done_or_voided := v_kitchen_done_or_voided + 1;
    end if;
  end loop;

  if v_kitchen_count = 0 then
    if jsonb_array_length(v_merged) = 0 then
      v_status := 'pending';
    elsif v_has_buffet then
      v_status := 'done';
    else
      v_status := 'pending';
    end if;
  elsif v_kitchen_voided = v_kitchen_count then
    v_status := 'pending';
  elsif v_kitchen_done_or_voided = v_kitchen_count then
    v_status := 'done';
  elsif exists (
    select 1
    from jsonb_array_elements(v_merged) e
    where coalesce(e->>'kind', '') is distinct from 'buffet_base'
      and coalesce(e->>'item_status', 'pending') in ('cooking', 'ready', 'done')
  ) then
    v_status := 'cooking';
  else
    v_status := 'pending';
  end if;

  if not v_is_first_order then
    update public.orders
    set
      items = v_merged,
      total_amount = v_total,
      status = v_status
    where id = v_order.id
      and restaurant_id = p_restaurant_id;

    return jsonb_build_object(
      'ok', true,
      'order_id', v_order.id,
      'had_done_before', v_had_done_before,
      'is_first_order', false
    );
  end if;

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
    p_session_id,
    p_table_id,
    coalesce(nullif(trim(p_display_name), ''), p_table_id::text),
    v_status,
    v_merged,
    v_total
  )
  returning id into v_new_id;

  return jsonb_build_object(
    'ok', true,
    'order_id', v_new_id,
    'had_done_before', false,
    'is_first_order', true
  );
end;
$function$;

revoke all on function public.append_order_items(uuid, uuid, uuid, text, jsonb) from public;
grant execute on function public.append_order_items(uuid, uuid, uuid, text, jsonb) to service_role;

comment on function public.append_order_items(uuid, uuid, uuid, text, jsonb) is
  'Sole guest/waiter append write: session advisory lock + latest order FOR UPDATE; append items or insert. Prevents concurrent jsonb lost updates.';
