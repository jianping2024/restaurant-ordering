-- Settled checkout close stores billable payable once; do not mutate orders.items for sushi.
-- Revenue / history prefer this snapshot over order.total_amount.
-- After applying locally: restart PostgREST (`docker restart supabase_rest_restaurant-ordering`)
-- so RPC/REST pick up the new column and function signature.

alter table public.table_sessions
  add column if not exists settled_payable_amount numeric;

comment on column public.table_sessions.settled_payable_amount is
  'Billable session payable written at settled checkout close (sumBillableSessionTotal). Null for operational closes and legacy rows.';

create or replace function public.close_table_session_settled(
  p_restaurant_id uuid,
  p_table_id uuid,
  p_closed_reason text,
  p_closed_by_user_id uuid default null,
  p_settled_payable_amount numeric default null
) returns jsonb
language plpgsql
security definer
set search_path to public
as $$
declare
  v_session public.table_sessions%rowtype;
  v_now timestamptz := now();
begin
  select *
    into v_session
    from public.table_sessions
   where restaurant_id = p_restaurant_id
     and table_id = p_table_id
     and status in ('open', 'billing')
   order by opened_at desc
   limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'no_session');
  end if;

  perform pg_advisory_xact_lock(hashtext(v_session.id::text));

  perform 1
    from public.bill_splits
   where restaurant_id = p_restaurant_id
     and session_id = v_session.id
     and status in ('pending', 'confirmed', 'requested')
   for update;

  select *
    into v_session
    from public.table_sessions
   where id = v_session.id
     and restaurant_id = p_restaurant_id
   for update;

  if v_session.status not in ('open', 'billing') then
    return jsonb_build_object('ok', false, 'code', 'no_session');
  end if;

  update public.bill_splits
     set status = 'cancelled'
   where restaurant_id = p_restaurant_id
     and session_id = v_session.id
     and status in ('pending', 'confirmed', 'requested');

  update public.table_sessions
     set
       status = 'closed',
       closed_at = v_now,
       closed_reason = p_closed_reason,
       closed_by_user_id = p_closed_by_user_id,
       settled_payable_amount = case
         when p_settled_payable_amount is null then settled_payable_amount
         else round(p_settled_payable_amount, 2)
       end
   where id = v_session.id;

  return jsonb_build_object(
    'ok', true,
    'session_id', v_session.id,
    'settled_payable_amount', (
      select settled_payable_amount
        from public.table_sessions
       where id = v_session.id
    )
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

revoke all on function public.close_table_session_settled(uuid, uuid, text, uuid, numeric) from public;
grant execute on function public.close_table_session_settled(uuid, uuid, text, uuid, numeric)
  to authenticated, service_role;

-- Drop 4-arg overload so callers cannot skip settled payable by resolving the old signature.
drop function if exists public.close_table_session_settled(uuid, uuid, text, uuid);

create or replace function public.dashboard_overview_revenue_bundle(
  p_restaurant_id uuid,
  p_start_utc timestamptz,
  p_end_exclusive_utc timestamptz,
  p_max_sessions integer default 2000
)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_session_count integer;
  v_sessions jsonb;
  v_orders jsonb;
  v_splits jsonb;
  v_unpaid jsonb;
begin
  select count(*)::integer
    into v_session_count
    from public.table_sessions ts
   where ts.restaurant_id = p_restaurant_id
     and ts.status = 'closed'
     and ts.closed_at is not null
     and ts.closed_at >= p_start_utc
     and ts.closed_at < p_end_exclusive_utc;

  if v_session_count > greatest(coalesce(p_max_sessions, 2000), 1) then
    return jsonb_build_object(
      'ok', false,
      'code', 'query_limit_exceeded',
      'session_count', v_session_count
    );
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', ts.id,
        'closed_at', ts.closed_at,
        'closed_reason', ts.closed_reason,
        'settled_payable_amount', ts.settled_payable_amount
      )
      order by ts.closed_at
    ),
    '[]'::jsonb
  )
    into v_sessions
    from public.table_sessions ts
   where ts.restaurant_id = p_restaurant_id
     and ts.status = 'closed'
     and ts.closed_at is not null
     and ts.closed_at >= p_start_utc
     and ts.closed_at < p_end_exclusive_utc;

  if v_session_count = 0 then
    return jsonb_build_object(
      'ok', true,
      'sessions', '[]'::jsonb,
      'orders', '[]'::jsonb,
      'splits', '[]'::jsonb,
      'unpaid_session_ids', '[]'::jsonb
    );
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', o.id,
        'session_id', o.session_id,
        'status', o.status,
        'total_amount', o.total_amount
      )
    ),
    '[]'::jsonb
  )
    into v_orders
    from public.orders o
   where o.restaurant_id = p_restaurant_id
     and o.session_id in (
       select ts.id
         from public.table_sessions ts
        where ts.restaurant_id = p_restaurant_id
          and ts.status = 'closed'
          and ts.closed_at is not null
          and ts.closed_at >= p_start_utc
          and ts.closed_at < p_end_exclusive_utc
     );

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', bs.id,
        'session_id', bs.session_id,
        'status', bs.status,
        'result', bs.result,
        'total_amount', bs.total_amount,
        'discount_rate', bs.discount_rate
      )
    ),
    '[]'::jsonb
  )
    into v_splits
    from public.bill_splits bs
   where bs.restaurant_id = p_restaurant_id
     and bs.session_id in (
       select ts.id
         from public.table_sessions ts
        where ts.restaurant_id = p_restaurant_id
          and ts.status = 'closed'
          and ts.closed_at is not null
          and ts.closed_at >= p_start_utc
          and ts.closed_at < p_end_exclusive_utc
     );

  select coalesce(jsonb_agg(distinct ao.session_id), '[]'::jsonb)
    into v_unpaid
    from public.abnormal_operations ao
   where ao.restaurant_id = p_restaurant_id
     and ao.type = 'UNPAID_TABLE_CLOSED'
     and ao.session_id in (
       select ts.id
         from public.table_sessions ts
        where ts.restaurant_id = p_restaurant_id
          and ts.status = 'closed'
          and ts.closed_at is not null
          and ts.closed_at >= p_start_utc
          and ts.closed_at < p_end_exclusive_utc
     );

  return jsonb_build_object(
    'ok', true,
    'sessions', v_sessions,
    'orders', v_orders,
    'splits', v_splits,
    'unpaid_session_ids', v_unpaid
  );
end;
$$;

revoke all on function public.dashboard_overview_revenue_bundle(uuid, timestamptz, timestamptz, integer) from public;
grant execute on function public.dashboard_overview_revenue_bundle(uuid, timestamptz, timestamptz, integer)
  to service_role;
