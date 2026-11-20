-- Buffet is fixed once the table is opened (floor `packageLocked` + pipeline 409
-- `buffet_switch_locked`); the「换套餐」RPC has no caller (TS `switchTableBuffet` removed).
-- `order_item_is_buffet_priced` stays — `append_order_items` still uses it.
DROP FUNCTION IF EXISTS public.switch_table_buffet(uuid, uuid, uuid, text, uuid, jsonb, jsonb);
