-- Orders where every line is voided were previously derived as status 'done', which hid the table
-- from the kitchen main board. Keep them as pending so staff still see the open table until new items arrive.

update public.orders
set status = 'pending'
where status = 'done'
  and jsonb_array_length(items) > 0
  and not exists (
    select 1
    from jsonb_array_elements(items) as el
    where coalesce(el->>'item_status', 'pending') <> 'voided'
  );
