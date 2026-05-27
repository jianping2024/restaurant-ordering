-- Repair orders left on closed merged sessions (lost from waiter board after bad merge).

update public.orders o
set session_id = ts.merge_into_session_id
from public.table_sessions ts
where o.session_id = ts.id
  and ts.status = 'closed'
  and ts.closed_reason = 'merged'
  and ts.merge_into_session_id is not null
  and o.status in ('pending', 'cooking', 'done');
