-- After even rename-append repair collapsed result rows, rematch ledger
-- person_index to the seat that still carries the same person_name (case-insensitive).

update public.session_collected_payments scp
set person_index = matched.idx
from (
  select
    bs.id as bill_split_id,
    bs.session_id,
    bs.restaurant_id,
    (ord - 1)::integer as idx,
    lower(btrim(elem->>'name')) as name_key
  from public.bill_splits bs
  cross join lateral jsonb_array_elements(coalesce(bs.result, '[]'::jsonb))
    with ordinality as t(elem, ord)
  where bs.split_mode = 'even'
    and bs.status in ('pending', 'confirmed', 'requested')
    and btrim(coalesce(elem->>'name', '')) <> ''
) matched
where scp.restaurant_id = matched.restaurant_id
  and scp.session_id = matched.session_id
  and (scp.bill_split_id is null or scp.bill_split_id = matched.bill_split_id)
  and lower(btrim(scp.person_name)) = matched.name_key
  and scp.person_index is distinct from matched.idx;
