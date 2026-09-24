-- Persist fiscal issue result on bill_sync ack (document_id for reprint; invoice_no for UI).

ALTER TABLE public.bill_sync_jobs
  ADD COLUMN IF NOT EXISTS document_id text;

ALTER TABLE public.bill_sync_jobs
  ADD COLUMN IF NOT EXISTS invoice_no text;

COMMENT ON COLUMN public.bill_sync_jobs.document_id IS
  'Agent fiscal invoices.id after auto_issue success; sole cloud key for reprint.';

COMMENT ON COLUMN public.bill_sync_jobs.invoice_no IS
  'Agent invoice_no copy after auto_issue success (display / toast).';

CREATE INDEX IF NOT EXISTS bill_sync_jobs_sale_issued_idx
  ON public.bill_sync_jobs (restaurant_id, source_sale_id, created_at desc)
  WHERE document_id IS NOT NULL AND status = 'succeeded';
