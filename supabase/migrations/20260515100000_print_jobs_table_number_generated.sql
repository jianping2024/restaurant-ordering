-- Denormalize payload.table_number for lightweight list queries (dashboard / waiter queue).
alter table public.print_jobs
  add column if not exists table_number integer
  generated always as (
    case jsonb_typeof(payload->'table_number')
      when 'number' then (payload->'table_number')::text::integer
      when 'string' then nullif(btrim(payload->>'table_number'), '')::integer
      else null
    end
  ) stored;
