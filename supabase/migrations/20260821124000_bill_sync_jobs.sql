-- Bill sync jobs: Farvoo hang-queue for fiscal Agent (bill-sync-contract-v1.0).
-- Separate from print_jobs; same print_agent Realtime SELECT pattern.

CREATE TABLE IF NOT EXISTS public.bill_sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants (id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  source_system text NOT NULL DEFAULT 'farvoo'
    CHECK (source_system = 'farvoo'),
  source_sale_id uuid NOT NULL,
  table_display_name text NOT NULL,
  scope_type text NOT NULL
    CHECK (scope_type = ANY (ARRAY['whole_table'::text, 'split'::text])),
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status = ANY (ARRAY[
      'pending'::text,
      'processing'::text,
      'succeeded'::text,
      'failed'::text
    ])),
  error_code text,
  error_message text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bill_sync_jobs_restaurant_request_unique UNIQUE (restaurant_id, request_id)
);

CREATE INDEX IF NOT EXISTS bill_sync_jobs_restaurant_status_created_idx
  ON public.bill_sync_jobs (restaurant_id, status, created_at);

CREATE INDEX IF NOT EXISTS bill_sync_jobs_restaurant_source_sale_idx
  ON public.bill_sync_jobs (restaurant_id, source_sale_id, created_at DESC);

ALTER TABLE public.bill_sync_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bill_sync_jobs_print_agent_select" ON public.bill_sync_jobs;
CREATE POLICY "bill_sync_jobs_print_agent_select"
  ON public.bill_sync_jobs
  FOR SELECT
  TO authenticated
  USING (
    public.is_active_restaurant_staff(restaurant_id, ARRAY['print_agent'::text])
  );

-- Staff/owner may read own restaurant jobs (checkout status UI).
DROP POLICY IF EXISTS "bill_sync_jobs_staff_select" ON public.bill_sync_jobs;
CREATE POLICY "bill_sync_jobs_staff_select"
  ON public.bill_sync_jobs
  FOR SELECT
  TO authenticated
  USING (
    public.is_active_restaurant_staff(
      restaurant_id,
      ARRAY['kitchen'::text, 'waiter'::text, 'cashier'::text, 'frontdesk'::text, 'print_agent'::text]
    )
    OR restaurant_id IN (
      SELECT r.id FROM public.restaurants r WHERE r.owner_id = auth.uid()
    )
  );

COMMENT ON TABLE public.bill_sync_jobs IS
  'Hang-queue for Farvoo→fiscal bill-sync drafts; Agent pulls via agentjwt + Realtime on this table.';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'bill_sync_jobs'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.bill_sync_jobs;
    END IF;
  END IF;
END $$;
