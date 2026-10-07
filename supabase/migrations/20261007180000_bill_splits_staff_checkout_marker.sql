-- Staff took over checkout for a split: keep it in the checkout queue while money is owed.
-- Root cause: staff 呼叫结账 (upsert_bill_split_request) and a by-item collect that must hold
-- the session open (confirm_bill_split_payment p_hold_open) both write status='requested', but
-- bill_splits_individual_sync → individual_refresh_split_status (sole status writer) demoted it to
-- 'confirmed' whenever no called-unpaid ticket existed — e.g. every ticket paid while by-item
-- dishes are still unallocated. The table then stayed open yet never reached the queue.
-- Sole marker: bill_splits.staff_checkout_requested_at. Set only via
-- mark_bill_split_staff_checkout (staff call entry + held-open collect); cleared by resume.

alter table public.bill_splits
  add column if not exists staff_checkout_requested_at timestamptz;

comment on column public.bill_splits.staff_checkout_requested_at is
  'Staff took over checkout (floor 呼叫结账 or by-item collect held open). While set, individual_refresh_split_status keeps status=requested. Cleared by resume_table_session_ordering.';

-- Sole writer of bill_splits.status for individual sessions (now honors the staff marker).
create or replace function public.individual_refresh_split_status(p_split_id uuid)
returns void
language plpgsql
security definer
set search_path to public
as $$
declare
  v_status text;
  v_staff_requested boolean;
  v_next text;
begin
  select status, staff_checkout_requested_at is not null
  into v_status, v_staff_requested
  from public.bill_splits
  where id = p_split_id;
  if v_status is null or v_status not in ('pending', 'confirmed', 'requested') then
    return;
  end if;
  v_next := case
    when v_staff_requested then 'requested'
    when public.individual_split_has_called_unpaid(p_split_id) then 'requested'
    else 'confirmed'
  end;
  if v_status is distinct from v_next then
    update public.bill_splits set status = v_next where id = p_split_id;
  end if;
end;
$$;

-- Sole setter of the staff checkout marker (bill_splits_individual_sync then refreshes status).
create or replace function public.mark_bill_split_staff_checkout(
  p_restaurant_id uuid,
  p_bill_split_id uuid
) returns boolean
language plpgsql
security definer
set search_path to public
as $$
begin
  update public.bill_splits
  set staff_checkout_requested_at = coalesce(staff_checkout_requested_at, now())
  where id = p_bill_split_id
    and restaurant_id = p_restaurant_id
    and status in ('pending', 'confirmed', 'requested');
  return found;
end;
$$;

revoke all on function public.mark_bill_split_staff_checkout(uuid, uuid) from public;
grant execute on function public.mark_bill_split_staff_checkout(uuid, uuid) to service_role;

-- 恢复点单 clears the marker in the same statement that resets the preserved split.
CREATE OR REPLACE FUNCTION public.resume_table_session_ordering(p_restaurant_id uuid, p_table_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_session public.table_sessions%rowtype;
  v_split public.bill_splits%rowtype;
  v_row jsonb;
  v_len integer;
  v_i integer;
  v_has_paid_row boolean := false;
  v_has_partial_payment boolean := false;
  v_preserve_split boolean := false;
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
    if v_len > 0 then
      for v_i in 0 .. v_len - 1 loop
        v_row := v_split.result -> v_i;
        if coalesce((v_row->>'paid')::boolean, false) then
          v_has_paid_row := true;
          exit;
        end if;
      end loop;
    end if;

    v_has_partial_payment := v_has_paid_row or exists (
      select 1
      from public.session_collected_payments scp
      where scp.restaurant_id = p_restaurant_id
        and scp.session_id = v_session.id
    );

    if coalesce(v_split.split_mode, '') = 'by_item' then
      null;
    elsif v_len <= 1 and v_has_partial_payment then
      return jsonb_build_object('ok', false, 'code', 'whole_table_paid');
    end if;

    v_preserve_split := v_split.split_mode = 'by_item' or v_has_partial_payment;

    if v_preserve_split then
      update public.bill_splits
      set
        status = 'confirmed',
        staff_checkout_requested_at = null,
        result = public.reconcile_split_result_paid_from_ledger(
          result,
          p_restaurant_id,
          v_session.id,
          coalesce(discount_rate, 0)
        )
      where restaurant_id = p_restaurant_id
        and session_id = v_session.id
        and status in ('pending', 'confirmed', 'requested');
    else
      update public.bill_splits
      set status = 'cancelled',
          staff_checkout_requested_at = null
      where restaurant_id = p_restaurant_id
        and session_id = v_session.id
        and status in ('pending', 'confirmed', 'requested');
    end if;
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
$function$;
