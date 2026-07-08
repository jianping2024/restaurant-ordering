-- Rollback unauthorized cloud push of 20260712120000, 20260713120000, 20260714120000.
-- Restores schema to pre-push state. Cannot restore print_jobs.payload ticket_layout values removed by the drop migration.

-- 1) Restore print_stations.ticket_layout (20260714120000)
CREATE OR REPLACE FUNCTION public.seed_default_print_stations_for_restaurant() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  insert into public.print_stations (restaurant_id, name_pt, name_en, name_zh, sort_order, ticket_layout)
  select new.id, 'Cozinha', 'Kitchen', '后厨', 0, 'kitchen'
  where not exists (
    select 1 from public.print_stations ps where ps.restaurant_id = new.id and ps.ticket_layout = 'kitchen'
  );
  insert into public.print_stations (restaurant_id, name_pt, name_en, name_zh, sort_order, ticket_layout)
  select new.id, 'Bar', 'Bar', '吧台', 1, 'beverage'
  where not exists (
    select 1 from public.print_stations ps where ps.restaurant_id = new.id and ps.ticket_layout = 'beverage'
  );
  return new;
end;
$$;
ALTER TABLE public.print_stations
  ADD COLUMN IF NOT EXISTS ticket_layout text DEFAULT 'standard'::text NOT NULL;
ALTER TABLE public.print_stations
  DROP CONSTRAINT IF EXISTS print_stations_ticket_layout_check;
ALTER TABLE public.print_stations
  ADD CONSTRAINT print_stations_ticket_layout_check
  CHECK (ticket_layout = ANY (ARRAY['kitchen'::text, 'beverage'::text, 'standard'::text]));
UPDATE public.print_stations ps
SET ticket_layout = 'kitchen'
WHERE ps.ticket_layout = 'standard'
  AND (ps.name_pt = 'Cozinha' OR ps.name_zh = '后厨');
UPDATE public.print_stations ps
SET ticket_layout = 'beverage'
WHERE ps.ticket_layout = 'standard'
  AND (ps.name_pt = 'Bar' OR ps.name_zh = '吧台');
-- 2) Remove restaurant_tables seat capacity (20260713120000)
ALTER TABLE public.restaurant_tables
  DROP CONSTRAINT IF EXISTS restaurant_tables_seat_range_valid;
ALTER TABLE public.restaurant_tables
  DROP CONSTRAINT IF EXISTS restaurant_tables_seat_min_range;
ALTER TABLE public.restaurant_tables
  DROP CONSTRAINT IF EXISTS restaurant_tables_seat_max_range;
ALTER TABLE public.restaurant_tables
  DROP COLUMN IF EXISTS seat_min;
ALTER TABLE public.restaurant_tables
  DROP COLUMN IF EXISTS seat_max;
-- 3) Restore restaurant_staff_accounts.email (20260712120000)
DROP INDEX IF EXISTS public.restaurant_staff_accounts_login_name_key;
ALTER TABLE public.restaurant_staff_accounts
  ADD COLUMN IF NOT EXISTS email text;
UPDATE public.restaurant_staff_accounts rsa
SET email = u.email
FROM auth.users u
WHERE rsa.user_id = u.id
  AND (rsa.email IS NULL OR rsa.email = '');
UPDATE public.restaurant_staff_accounts
SET email = login_name || '@staff.local'
WHERE email IS NULL OR email = '';
ALTER TABLE public.restaurant_staff_accounts
  ALTER COLUMN email SET NOT NULL;
ALTER TABLE public.restaurant_staff_accounts
  DROP CONSTRAINT IF EXISTS restaurant_staff_accounts_email_key;
ALTER TABLE public.restaurant_staff_accounts
  ADD CONSTRAINT restaurant_staff_accounts_email_key UNIQUE (email);
