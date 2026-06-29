-- Drop legacy 4-arg confirm_bill_split_payment overload.
-- Discount is persisted on bill_splits.discount_rate (20260706120000).
-- Keeping both (uuid,uuid,int) and (uuid,uuid,int,numeric default 0) makes
-- 3-arg RPC calls ambiguous: "function ... is not unique" (SQLSTATE 42725).

drop function if exists public.confirm_bill_split_payment(uuid, uuid, integer, numeric);
