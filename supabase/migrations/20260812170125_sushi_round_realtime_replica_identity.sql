-- Filtered postgres_changes on non-PK columns (session_id / round_id) need FULL
-- so UPDATE/DELETE payloads include filter columns for Realtime.

ALTER TABLE public.table_order_rounds REPLICA IDENTITY FULL;
ALTER TABLE public.table_order_round_lines REPLICA IDENTITY FULL;
ALTER TABLE public.table_order_round_votes REPLICA IDENTITY FULL;
