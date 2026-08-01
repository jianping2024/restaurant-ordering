-- Mode B: baseline dump does not carry publication membership; covered migrations
-- skip the initial ALTER PUBLICATION. Run every apply-migrations (idempotent).
DO $$
DECLARE
  t text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    RAISE NOTICE 'supabase_realtime publication missing — skip ensure';
    RETURN;
  END IF;
  -- print_jobs: print-agent Realtime CDC (station tickets / receipts)
  FOREACH t IN ARRAY ARRAY['orders', 'table_sessions', 'bill_splits', 'print_jobs']
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
