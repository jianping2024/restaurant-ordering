-- Countdown send only: remove abandoned vote/defer schema.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'table_order_round_votes'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.table_order_round_votes;
  END IF;
END $$;

DROP TABLE IF EXISTS public.table_order_round_votes;

ALTER TABLE public.table_order_rounds
  DROP COLUMN IF EXISTS defer_used_at,
  DROP COLUMN IF EXISTS defer_cooldown_until;

ALTER TABLE public.restaurants
  DROP COLUMN IF EXISTS sushi_round_defer_cooldown_seconds;
