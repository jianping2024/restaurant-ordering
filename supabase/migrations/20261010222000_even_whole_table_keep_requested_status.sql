-- Re-apply: individual_refresh_split_status only rewrites status for by_item.
-- Whole-table / even keep the status set by upsert / resume / payment.
--
-- Why a new migration: 20261008220000 already authored this body and is stamped
-- on some DBs, but local Docker still ran the older demote-to-confirmed path
-- (no called-unpaid ticket → confirmed). Guest even/whole_table call then left
-- the session in billing while bill_splits dropped out of the checkout queue.

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
