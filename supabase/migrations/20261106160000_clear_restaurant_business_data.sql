-- Sole RPC: wipe one restaurant's runtime/test business rows (keep menu/tables/staff/print setup).
-- Invoked only via service_role from owner clear-business-data API.

CREATE TABLE IF NOT EXISTS public.fiscal_clear_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'expired')),
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  error_code text NULL,
  error_message text NULL
);

CREATE INDEX IF NOT EXISTS idx_fiscal_clear_jobs_restaurant_status_created
  ON public.fiscal_clear_jobs (restaurant_id, status, created_at DESC);

ALTER TABLE public.fiscal_clear_jobs ENABLE ROW LEVEL SECURITY;
-- No anon/authenticated policies — service_role / print-agent JWT paths only.

COMMENT ON TABLE public.fiscal_clear_jobs IS
  'Hang-queue: Agent wipes local test fiscal sales (invoices/drafts) then acks. Pre-delivery clear only.';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'fiscal_clear_jobs'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.fiscal_clear_jobs;
    END IF;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.clear_restaurant_business_data(p_restaurant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exists boolean;
BEGIN
  IF p_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'restaurant_id_required';
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.restaurants WHERE id = p_restaurant_id)
    INTO v_exists;
  IF NOT v_exists THEN
    RAISE EXCEPTION 'restaurant_not_found';
  END IF;

  -- Jobs / logs / analytics (no session FK dependency for these deletes)
  DELETE FROM public.cash_drawer_jobs WHERE restaurant_id = p_restaurant_id;
  DELETE FROM public.print_jobs WHERE restaurant_id = p_restaurant_id;
  DELETE FROM public.bill_sync_jobs WHERE restaurant_id = p_restaurant_id;
  DELETE FROM public.fiscal_clear_jobs WHERE restaurant_id = p_restaurant_id;
  DELETE FROM public.abnormal_operations WHERE restaurant_id = p_restaurant_id;
  DELETE FROM public.operation_logs WHERE restaurant_id = p_restaurant_id;
  DELETE FROM public.analytics_daily_restaurant_stats WHERE restaurant_id = p_restaurant_id;
  DELETE FROM public.analytics_daily_menu_item_stats WHERE restaurant_id = p_restaurant_id;
  DELETE FROM public.analytics_daily_menu_item_consumption WHERE restaurant_id = p_restaurant_id;

  -- Session-linked (explicit before sessions; some SET NULL on session delete)
  DELETE FROM public.dish_feedback WHERE restaurant_id = p_restaurant_id;
  DELETE FROM public.feedback_sessions WHERE restaurant_id = p_restaurant_id;
  DELETE FROM public.bill_split_ticket_calls WHERE restaurant_id = p_restaurant_id;
  DELETE FROM public.table_checkout_signals WHERE restaurant_id = p_restaurant_id;
  DELETE FROM public.session_collected_payments WHERE restaurant_id = p_restaurant_id;
  DELETE FROM public.order_append_idempotency WHERE restaurant_id = p_restaurant_id;
  DELETE FROM public.table_order_round_lines
    WHERE round_id IN (
      SELECT id FROM public.table_order_rounds WHERE restaurant_id = p_restaurant_id
    );
  DELETE FROM public.table_order_round_clients WHERE restaurant_id = p_restaurant_id;
  DELETE FROM public.table_order_rounds WHERE restaurant_id = p_restaurant_id;
  DELETE FROM public.table_session_events WHERE restaurant_id = p_restaurant_id;

  UPDATE public.table_sessions
    SET merge_into_session_id = NULL
    WHERE restaurant_id = p_restaurant_id
      AND merge_into_session_id IS NOT NULL;

  DELETE FROM public.bill_splits WHERE restaurant_id = p_restaurant_id;
  DELETE FROM public.orders WHERE restaurant_id = p_restaurant_id;
  DELETE FROM public.table_sessions WHERE restaurant_id = p_restaurant_id;

  DELETE FROM public.table_party_group_members WHERE restaurant_id = p_restaurant_id;
  DELETE FROM public.table_party_groups WHERE restaurant_id = p_restaurant_id;

  RETURN jsonb_build_object('ok', true, 'restaurant_id', p_restaurant_id);
END;
$$;

REVOKE ALL ON FUNCTION public.clear_restaurant_business_data(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.clear_restaurant_business_data(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clear_restaurant_business_data(uuid) TO service_role;

COMMENT ON FUNCTION public.clear_restaurant_business_data(uuid) IS
  'Owner pre-delivery wipe: runtime sessions/orders/checkout/print/analytics/logs/party groups. Keeps menu, tables, staff, print stations, devices, fiscal signing install.';
