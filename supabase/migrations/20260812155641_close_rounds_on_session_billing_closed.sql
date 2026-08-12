-- Close active sushi table-order rounds whenever a session enters billing or closed.
-- One trigger covers all close/billing RPCs (no per-function round UPDATE copies).

CREATE OR REPLACE FUNCTION public.close_table_order_rounds_on_session_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('billing', 'closed') THEN
    UPDATE public.table_order_rounds
    SET
      status = 'closed',
      updated_at = now()
    WHERE session_id = NEW.id
      AND status IS DISTINCT FROM 'closed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_close_table_order_rounds_on_session_status
  ON public.table_sessions;

CREATE TRIGGER trg_close_table_order_rounds_on_session_status
  AFTER UPDATE OF status ON public.table_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.close_table_order_rounds_on_session_status();

REVOKE ALL ON FUNCTION public.close_table_order_rounds_on_session_status() FROM PUBLIC;
