-- Customer Realtime (postgres_cdc_rls) + anon SELECT on round tables failed because
-- policies used EXISTS (SELECT … FROM table_sessions …) and table_sessions RLS hides
-- those rows from anon → EXISTS always false → no CDC payloads (orders same pattern
-- for anon; staff JWT still works). Use a SECURITY DEFINER session-status check.

CREATE OR REPLACE FUNCTION public.table_session_is_open_or_billing(p_session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.table_sessions s
    WHERE s.id = p_session_id
      AND s.status IN ('open', 'billing')
  );
$$;

REVOKE ALL ON FUNCTION public.table_session_is_open_or_billing(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.table_session_is_open_or_billing(uuid) TO anon, authenticated, service_role;

DROP POLICY IF EXISTS table_order_rounds_select_open_session ON public.table_order_rounds;
CREATE POLICY table_order_rounds_select_open_session
  ON public.table_order_rounds
  FOR SELECT
  TO anon, authenticated
  USING (public.table_session_is_open_or_billing(session_id));

DROP POLICY IF EXISTS table_order_round_lines_select_open_session ON public.table_order_round_lines;
CREATE POLICY table_order_round_lines_select_open_session
  ON public.table_order_round_lines
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.table_order_rounds r
      WHERE r.id = table_order_round_lines.round_id
        AND public.table_session_is_open_or_billing(r.session_id)
    )
  );

DROP POLICY IF EXISTS table_order_round_votes_select_open_session ON public.table_order_round_votes;
CREATE POLICY table_order_round_votes_select_open_session
  ON public.table_order_round_votes
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.table_order_rounds r
      WHERE r.id = table_order_round_votes.round_id
        AND public.table_session_is_open_or_billing(r.session_id)
    )
  );
