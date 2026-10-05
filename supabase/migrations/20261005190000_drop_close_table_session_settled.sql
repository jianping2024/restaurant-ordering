-- Remove the settled 关台结账 RPC.
-- The 关台结账 entry (POST /api/dashboard/checkout-close-table-session) is gone; checkout now
-- always goes 呼叫结账 → collect → the last confirm_bill_split_payment closes the session, and
-- 强制关台 uses close_table_session_operational. Nothing calls this function any more.
--
-- Data is untouched: table_sessions.settled_payable_amount and the legacy closed_reason values
-- (frontdesk_closed / cashier_closed / owner_closed) stay for order history and analytics.
-- Both signatures are dropped idempotently: the 5-arg one is live; the 4-arg overload only
-- survives in the on-prem schema baseline.

drop function if exists public.close_table_session_settled(uuid, uuid, text, uuid, numeric);
drop function if exists public.close_table_session_settled(uuid, uuid, text, uuid);
