-- ISO 3166-1 alpha-2 store country for compliance / partitioning (not print locale).
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS country_code char(2);

UPDATE public.restaurants
SET country_code = 'PT'
WHERE country_code IS NULL;

ALTER TABLE public.restaurants
  ALTER COLUMN country_code SET DEFAULT 'PT',
  ALTER COLUMN country_code SET NOT NULL;

ALTER TABLE public.restaurants
  DROP CONSTRAINT IF EXISTS restaurants_country_code_check;

ALTER TABLE public.restaurants
  ADD CONSTRAINT restaurants_country_code_check
  CHECK (country_code ~ '^[A-Z]{2}$');
