-- Table seat capacity for floor board display (min/max guests per table).
ALTER TABLE public.restaurant_tables
  ADD COLUMN IF NOT EXISTS seat_min integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS seat_max integer NOT NULL DEFAULT 4;
ALTER TABLE public.restaurant_tables
  DROP CONSTRAINT IF EXISTS restaurant_tables_seat_min_range;
ALTER TABLE public.restaurant_tables
  ADD CONSTRAINT restaurant_tables_seat_min_range
  CHECK (seat_min >= 1 AND seat_min <= 99);
ALTER TABLE public.restaurant_tables
  DROP CONSTRAINT IF EXISTS restaurant_tables_seat_max_range;
ALTER TABLE public.restaurant_tables
  ADD CONSTRAINT restaurant_tables_seat_max_range
  CHECK (seat_max >= 1 AND seat_max <= 99);
ALTER TABLE public.restaurant_tables
  DROP CONSTRAINT IF EXISTS restaurant_tables_seat_range_valid;
ALTER TABLE public.restaurant_tables
  ADD CONSTRAINT restaurant_tables_seat_range_valid
  CHECK (seat_min <= seat_max);
