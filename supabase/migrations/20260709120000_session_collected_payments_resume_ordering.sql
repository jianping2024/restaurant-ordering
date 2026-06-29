-- Session-level collected-payment ledger + resume ordering + confirm payment writes ledger.

create table public.session_collected_payments (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  session_id uuid not null references public.table_sessions (id) on delete cascade,
  person_name text not null,
  amount numeric not null check (amount > 0),
  bill_split_id uuid references public.bill_splits (id) on delete set null,
  created_by_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_session_collected_payments_session
  on public.session_collected_payments (session_id, created_at);

create index idx_session_collected_payments_restaurant
  on public.session_collected_payments (restaurant_id, created_at desc);

alter table public.session_collected_payments enable row level security;

create policy "session_collected_payments_cashier_select"
  on public.session_collected_payments
  for select
  to authenticated
  using (public.is_active_restaurant_staff(restaurant_id, array['cashier'::text]));

create policy "session_collected_payments_frontdesk_select"
  on public.session_collected_payments
  for select
  to authenticated
  using (public.is_active_restaurant_staff(restaurant_id, array['frontdesk'::text]));

create policy "session_collected_payments_owner_select"
  on public.session_collected_payments
  for select
  to authenticated
  using (
    restaurant_id in (
      select restaurants.id
      from public.restaurants
      where restaurants.owner_id = auth.uid()
    )
  );

comment on table public.session_collected_payments is
  'Append-only ledger of per-person collections within a table session; survives checkout resume and re-checkout.';

create or replace function public.confirm_bill_split_payment(
  p_restaurant_id uuid,
  p_bill_split_id uuid,
  p_person_index integer,
  p_collected_amount numeric default null,
  p_created_by_user_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path to public
as $$
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
  v_session_id uuid;
  v_precheck_status text;
  v_row_amount numeric;
  v_collected numeric;
begin
  if p_person_index is null or p_person_index < 0 then
    return jsonb_build_object('ok', false, 'code', 'invalid_person_index');
  end if;

  select session_id, status
  into v_session_id, v_precheck_status
  from public.bill_splits
  where id = p_bill_split_id
    and restaurant_id = p_restaurant_id;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'bill_split_not_found');
  end if;

  if v_precheck_status = 'cancelled' then
    return jsonb_build_object('ok', false, 'code', 'bill_split_cancelled');
  end if;

  if v_session_id is not null then
    perform pg_advisory_xact_lock(hashtext(v_session_id::text));
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

  if v_split.status = 'cancelled' then
    return jsonb_build_object('ok', false, 'code', 'bill_split_cancelled');
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

  v_rate := greatest(0, least(100, coalesce(v_split.discount_rate, 0)));
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

  v_row_amount := coalesce((v_row->>'amount')::numeric, 0);
  v_collected := coalesce(p_collected_amount, v_row_amount);
  if v_collected <= 0 then
    return jsonb_build_object('ok', false, 'code', 'invalid_collected_amount');
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

  if v_split.session_id is not null then
    insert into public.session_collected_payments (
      restaurant_id,
      session_id,
      person_name,
      amount,
      bill_split_id,
      created_by_user_id
    ) values (
      p_restaurant_id,
      v_split.session_id,
      coalesce(v_row ->> 'name', ''),
      v_collected,
      p_bill_split_id,
      p_created_by_user_id
    );
  end if;

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

    if v_session.status = 'closed' then
      return jsonb_build_object(
        'ok', false,
        'code', 'session_close_failed',
        'message', 'session already closed'
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
    'row_amount', v_collected,
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

revoke all on function public.confirm_bill_split_payment(uuid, uuid, integer) from public;
revoke all on function public.confirm_bill_split_payment(uuid, uuid, integer) from authenticated;
revoke all on function public.confirm_bill_split_payment(uuid, uuid, integer) from service_role;
drop function if exists public.confirm_bill_split_payment(uuid, uuid, integer);

revoke all on function public.confirm_bill_split_payment(uuid, uuid, integer, numeric, uuid) from public;
grant execute on function public.confirm_bill_split_payment(uuid, uuid, integer, numeric, uuid)
  to authenticated, service_role;

create or replace function public.resume_table_session_ordering(
  p_restaurant_id uuid,
  p_table_id uuid
) returns jsonb
language plpgsql
security definer
set search_path to public
as $$
declare
  v_session public.table_sessions%rowtype;
  v_split public.bill_splits%rowtype;
  v_row jsonb;
  v_len integer;
  v_has_paid_row boolean := false;
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

  select *
  into v_session
  from public.table_sessions
  where id = v_session.id
    and restaurant_id = p_restaurant_id
  for update;

  if v_session.status not in ('open', 'billing') then
    return jsonb_build_object('ok', false, 'code', 'no_session');
  end if;

  select *
  into v_split
  from public.bill_splits
  where restaurant_id = p_restaurant_id
    and session_id = v_session.id
    and status in ('pending', 'confirmed', 'requested')
  order by created_at desc
  limit 1
  for update;

  if found then
    v_len := jsonb_array_length(coalesce(v_split.result, '[]'::jsonb));
    if v_len <= 1 then
      if v_len = 1 then
        v_row := v_split.result -> 0;
        v_has_paid_row := coalesce((v_row->>'paid')::boolean, false);
      end if;
      if v_has_paid_row or exists (
        select 1
        from public.session_collected_payments scp
        where scp.restaurant_id = p_restaurant_id
          and scp.session_id = v_session.id
      ) then
        return jsonb_build_object('ok', false, 'code', 'whole_table_paid');
      end if;
    end if;

    update public.bill_splits
    set status = 'cancelled'
    where restaurant_id = p_restaurant_id
      and session_id = v_session.id
      and status in ('pending', 'confirmed', 'requested');
  end if;

  update public.table_sessions
  set status = 'open'
  where id = v_session.id
    and status = 'billing';

  return jsonb_build_object(
    'ok', true,
    'session_id', v_session.id,
    'table_id', p_table_id
  );
exception
  when others then
    return jsonb_build_object(
      'ok', false,
      'code', 'resume_failed',
      'message', sqlerrm
    );
end;
$$;

revoke all on function public.resume_table_session_ordering(uuid, uuid) from public;
grant execute on function public.resume_table_session_ordering(uuid, uuid)
  to authenticated, service_role;

create or replace function public.compute_session_payment_gap(
  p_restaurant_id uuid,
  p_session_id uuid
) returns jsonb
language plpgsql
stable
security definer
set search_path to public
as $$
declare
  v_payable numeric := 0;
  v_paid numeric := 0;
  v_has_unpaid_split boolean := false;
  v_gap numeric;
  v_order record;
  v_split record;
begin
  for v_order in
    select items
    from public.orders
    where restaurant_id = p_restaurant_id
      and session_id = p_session_id
  loop
    v_payable := v_payable + public.recalc_order_total_from_items(v_order.items);
  end loop;

  select coalesce(sum(amount), 0)
  into v_paid
  from public.session_collected_payments
  where restaurant_id = p_restaurant_id
    and session_id = p_session_id;

  for v_split in
    select status
    from public.bill_splits
    where restaurant_id = p_restaurant_id
      and session_id = p_session_id
  loop
    if v_split.status in ('pending', 'confirmed', 'requested') then
      v_has_unpaid_split := true;
    end if;
  end loop;

  v_gap := greatest(v_payable - v_paid, 0);

  return jsonb_build_object(
    'payable_amount', v_payable,
    'paid_amount', v_paid,
    'gap', v_gap,
    'has_unpaid_split', v_has_unpaid_split,
    'is_unpaid_close', v_has_unpaid_split or v_gap > 0.0001
  );
end;
$$;
