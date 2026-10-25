-- One station ticket per (order, batch, station). Concurrent / replayed enqueue
-- of the same batch used to insert twice because the app only pre-checked
-- pending/processing rows (no lock). The DB is now the sole dedupe guard.
--
-- Historical duplicates are kept (print history) and tagged with
-- payload.duplicate_of = <kept job id> so they sit outside the index.

WITH ranked AS (
  SELECT
    id,
    first_value(id) OVER w AS keep_id,
    row_number() OVER w AS rn
  FROM public.print_jobs
  WHERE type = 'station_ticket'
    AND NOT (payload ? 'duplicate_of')
  WINDOW w AS (
    PARTITION BY restaurant_id,
      payload->>'order_id',
      payload->>'batch_id',
      payload->>'print_station_id'
    ORDER BY created_at, id
  )
)
UPDATE public.print_jobs j
SET payload = j.payload || jsonb_build_object('duplicate_of', r.keep_id)
FROM ranked r
WHERE j.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_print_jobs_station_ticket_batch_station
  ON public.print_jobs (
    restaurant_id,
    (payload->>'order_id'),
    (payload->>'batch_id'),
    (payload->>'print_station_id')
  )
  WHERE type = 'station_ticket' AND NOT (payload ? 'duplicate_of');
