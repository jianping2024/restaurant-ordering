-- Settled table close: record cash/frontdesk checkout settlement, preserve orders, close session.
-- Distinct from close_table_session_operational (force cleanup / void).

create or replace function public.close_table_session_settled(
  p_restaurant_id uuid,
  p_table_id uuid,
  p_closed_reason text,
  p_closed_by_user_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path to public
as $$
declare
  v_session public.table_sessions%rowtype;
  v_billing_exists boolean := false;
  v_gap jsonb;
  v_payable numeric := 0;
  v_paid numeric := 0;
  v_has_unpaid_split boolean := false;
  v_has_kitchen_work boolean := false;
  v_has_paid_split boolean := false;
  v_display_name text;
  v_order_ids uuid[];
  v_bill_split_id uuid;
  v_result jsonb;
  v_now timestamptz := now();
begin
  select *
  into v_session
  from public.table_sessions
  where restaurant_id = p_restaurant_id
    and table_id = p_table_id
    and status = 'open'
  order by opened_at desc
  limit 1;

  if not found then
    select exists (
      select 1
      from public.table_sessions
      where restaurant_id = p_restaurant_id
        and table_id = p_table_id
        and status = 'billing'
    )
    into v_billing_exists;

    if v_billing_exists then
      return jsonb_build_object('ok', false, 'code', 'session_billing');
    end if;

    return jsonb_build_object('ok', false, 'code', 'no_session');
  end if;

  perform pg_advisory_xact_lock(hashtext(v_session.id::text));

  select *
  into v_session
  from public.table_sessions
  where id = v_session.id
    and restaurant_id = p_restaurant_id
  for update;

  if v_session.status <> 'open' then
    if v_session.status = 'billing' then
      return jsonb_build_object('ok', false, 'code', 'session_billing');
    end if;
    return jsonb_build_object('ok', false, 'code', 'no_session');
  end if;

  v_gap := public.compute_session_payment_gap(p_restaurant_id, v_session.id);
  v_payable := coalesce((v_gap->>'payable_amount')::numeric, 0);
  v_paid := coalesce((v_gap->>'paid_amount')::numeric, 0);
  v_has_unpaid_split := coalesce((v_gap->>'has_unpaid_split')::boolean, false);

  if v_has_unpaid_split then
    return jsonb_build_object('ok', false, 'code', 'checkout_in_progress');
  end if;

  if v_paid > 0.0001 then
    return jsonb_build_object('ok', false, 'code', 'partial_payment_ledger');
  end if;

  select exists (
    select 1
    from public.orders
    where restaurant_id = p_restaurant_id
      and session_id = v_session.id
      and status in ('pending', 'cooking')
  )
  into v_has_kitchen_work;

  if v_has_kitchen_work then
    return jsonb_build_object('ok', false, 'code', 'unfinished_kitchen_orders');
  end if;

  select exists (
    select 1
    from public.bill_splits
    where restaurant_id = p_restaurant_id
      and session_id = v_session.id
      and status = 'paid'
  )
  into v_has_paid_split;

  if not v_has_paid_split and v_payable > 0.0001 then
    select display_name
    into v_display_name
    from public.get_active_restaurant_table(p_restaurant_id, p_table_id);

    if v_display_name is null then
      return jsonb_build_object('ok', false, 'code', 'update_failed', 'message', 'invalid_table');
    end if;

    select coalesce(array_agg(id order by created_at), '{}'::uuid[])
    into v_order_ids
    from public.orders
    where restaurant_id = p_restaurant_id
      and session_id = v_session.id
      and status in ('pending', 'cooking', 'done');

    v_result := jsonb_build_array(
      jsonb_build_object(
        'name', 'Total',
        'amount', round(v_payable, 2),
        'paid', true
      )
    );

    insert into public.bill_splits (
      restaurant_id,
      session_id,
      table_id,
      display_name,
      order_ids,
      split_mode,
      persons,
      result,
      total_amount,
      status,
      discount_rate
    ) values (
      p_restaurant_id,
      v_session.id,
      p_table_id,
      v_display_name,
      coalesce(v_order_ids, '{}'::uuid[]),
      'even',
      '[]'::jsonb,
      v_result,
      round(v_payable, 2),
      'paid',
      0
    )
    returning id into v_bill_split_id;

    insert into public.session_collected_payments (
      restaurant_id,
      session_id,
      person_index,
      person_name,
      amount,
      bill_split_id,
      created_by_user_id
    ) values (
      p_restaurant_id,
      v_session.id,
      0,
      'Total',
      round(v_payable, 2),
      v_bill_split_id,
      p_closed_by_user_id
    );
  end if;

  update public.table_sessions
  set
    status = 'closed',
    closed_at = v_now,
    closed_reason = p_closed_reason,
    closed_by_user_id = p_closed_by_user_id
  where id = v_session.id;

  return jsonb_build_object(
    'ok', true,
    'session_id', v_session.id,
    'payable_amount', round(v_payable, 2)
  );
exception
  when others then
    return jsonb_build_object(
      'ok', false,
      'code', 'update_failed',
      'message', sqlerrm
    );
end;
$$;

revoke all on function public.close_table_session_settled(uuid, uuid, text, uuid) from public;
grant execute on function public.close_table_session_settled(uuid, uuid, text, uuid)
  to authenticated, service_role;
