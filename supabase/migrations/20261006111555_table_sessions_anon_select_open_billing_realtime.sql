-- Guest menu Realtime: discover 开台 on the QR table without a prior sessionId.
-- Filtered postgres_changes on table_id need FULL so UPDATE payloads keep the filter column.
-- Anon SELECT is limited to open|billing rows (same occupancy facts GET …/customer/session
-- already returns per table via service role). Closed rows stay invisible to anon.

ALTER TABLE public.table_sessions REPLICA IDENTITY FULL;

DROP POLICY IF EXISTS table_sessions_anon_select_open_billing ON public.table_sessions;
CREATE POLICY table_sessions_anon_select_open_billing
  ON public.table_sessions
  FOR SELECT
  TO anon
  USING (status IN ('open', 'billing'));

COMMENT ON POLICY table_sessions_anon_select_open_billing ON public.table_sessions IS
  'Anon Realtime CDC for guest menu table_id doorbell (开台 discovery). '
  'Only open|billing; closed rows remain hidden.';
