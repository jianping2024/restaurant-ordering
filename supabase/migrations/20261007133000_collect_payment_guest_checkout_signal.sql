-- Guest bill page refresh after staff collect: silent doorbell must fire on payment
-- (including last pay → status=paid). Realtime RLS must still allow SELECT after the
-- same transaction closes the session — use a signals-only session check that includes
-- closed (do not widen table_session_is_open_or_billing used by orders/rounds).

create or replace function public.table_session_allows_checkout_signals(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path to public
as $$
  select exists (
    select 1
    from public.table_sessions s
    where s.id = p_session_id
      and s.status in ('open', 'billing', 'closed')
  );
$$;

revoke all on function public.table_session_allows_checkout_signals(uuid) from public;
grant execute on function public.table_session_allows_checkout_signals(uuid)
  to anon, authenticated, service_role;

comment on function public.table_session_allows_checkout_signals(uuid) is
  'SECURITY DEFINER: guest Realtime/SELECT on table_checkout_signals while session is open, billing, or closed (last-pay doorbell after close). Do not use for orders/rounds.';

drop policy if exists table_checkout_signals_select_open_session on public.table_checkout_signals;
create policy table_checkout_signals_select_open_session
  on public.table_checkout_signals
  for select
  to anon, authenticated
  using (public.table_session_allows_checkout_signals(session_id));

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
    delete from public.bill_split_ticket_calls c
    where c.bill_split_id = new.id
      and not exists (
        select 1
        from jsonb_array_elements(coalesce(new.result, '[]'::jsonb)) as r(row)
        where public.individual_ticket_key(r.row) = c.ticket_key
      );

    if v_plan_edit then
      -- A staff plan write is a staff-initiated checkout for every unpaid ticket.
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

  perform public.individual_refresh_split_status(new.id);
  return null;
exception
  when others then
    -- Never block payments or plan writes because of bookkeeping.
    raise warning 'bill_splits_individual_sync failed: %', sqlerrm;
    return null;
end;
$$;
