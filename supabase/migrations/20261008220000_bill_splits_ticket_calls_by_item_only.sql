-- Per-ticket call rows (bill_split_ticket_calls) are only for by_item plans.
-- Whole-table / even staff checkout must not stamp calls — otherwise the staff UI
-- treats the plan as per-ticket unlock and hides session resume-ordering.
-- Also: individual_refresh_split_status only rewrites status for by_item; otherwise
-- clearing calls would demote whole_table/even requested → confirmed and drop the queue.
-- Append-only: replaces bodies from 20261007133000 + 20261007180000.

create or replace function public.bill_splits_individual_sync()
returns trigger
language plpgsql
security definer
set search_path to public
as $$
declare
  v_in_action boolean := coalesce(current_setting('mesa.individual_action', true), '') = '1';
  v_plan_edit boolean;
  v_plan_changed boolean;
begin
  if pg_trigger_depth() > 1 or new.session_id is null then
    return null;
  end if;

  -- Sole silent update doorbell for plan/payment changes (call/unlock set
  -- mesa.individual_action and insert their own call/unlock rows).
  v_plan_changed := tg_op = 'UPDATE'
    and (
      new.result is distinct from old.result
      or new.persons is distinct from old.persons
      or new.status is distinct from old.status
    );
  if not v_in_action and v_plan_changed then
    insert into public.table_checkout_signals (restaurant_id, session_id, kind, reason)
    values (new.restaurant_id, new.session_id, 'silent', 'update');
  end if;

  if new.status in ('paid', 'cancelled') then
    return null;
  end if;

  -- Staff plan write or staff-initiated checkout request (status flipped into requested).
  v_plan_edit := tg_op = 'INSERT'
    or new.persons is distinct from old.persons
    or new.split_mode is distinct from old.split_mode
    or (new.status = 'requested' and old.status is distinct from 'requested');

  if not v_in_action then
    if coalesce(new.split_mode, '') <> 'by_item' then
      -- Whole-table / even: session resume-ordering owns restore — never stamp ticket calls.
      delete from public.bill_split_ticket_calls c
      where c.bill_split_id = new.id;
    else
      delete from public.bill_split_ticket_calls c
      where c.bill_split_id = new.id
        and not exists (
          select 1
          from jsonb_array_elements(coalesce(new.result, '[]'::jsonb)) as r(row)
          where public.individual_ticket_key(r.row) = c.ticket_key
        );

      if v_plan_edit then
        -- A staff plan write is a staff-initiated checkout for every unpaid by_item ticket.
        insert into public.bill_split_ticket_calls (
          restaurant_id, session_id, bill_split_id, ticket_key, name, client_id, state
        )
        select new.restaurant_id, new.session_id, new.id,
               public.individual_ticket_key(r.row), coalesce(r.row ->> 'name', ''), null, 'called'
        from jsonb_array_elements(coalesce(new.result, '[]'::jsonb)) as r(row)
        where not coalesce((r.row ->> 'paid')::boolean, false)
          and public.individual_ticket_key(r.row) <> ''
        on conflict (bill_split_id, ticket_key)
        do update set state = 'called', updated_at = now()
        where bill_split_ticket_calls.state = 'unlocked';
      end if;
    end if;
  end if;

  perform public.individual_refresh_split_status(new.id);
  return null;
exception
  when others then
    -- Never block payments or plan writes because of bookkeeping.
    raise warning 'bill_splits_individual_sync failed: %', sqlerrm;
    return null;
end;
$$;

-- Sole status writer for by_item per-ticket plans. Whole-table / even keep the
-- status set by upsert / resume / payment — do not demote from missing call rows.
create or replace function public.individual_refresh_split_status(p_split_id uuid)
returns void
language plpgsql
security definer
set search_path to public
as $$
declare
  v_status text;
  v_split_mode text;
  v_staff_requested boolean;
  v_next text;
begin
  select status, split_mode, staff_checkout_requested_at is not null
  into v_status, v_split_mode, v_staff_requested
  from public.bill_splits
  where id = p_split_id;
  if v_status is null or v_status not in ('pending', 'confirmed', 'requested') then
    return;
  end if;
  if coalesce(v_split_mode, '') <> 'by_item' then
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
