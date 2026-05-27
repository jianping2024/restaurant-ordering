-- Allow staff/owner forced close to cancel in-flight checkout rows (not paid).

alter table public.bill_splits
  drop constraint if exists bill_splits_status_check;

alter table public.bill_splits
  add constraint bill_splits_status_check
  check (status in ('pending', 'confirmed', 'requested', 'paid', 'cancelled'));
