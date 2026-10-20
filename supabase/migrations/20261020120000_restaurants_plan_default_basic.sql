-- Align restaurants.plan DEFAULT with restaurants_plan_check (basic|pro).
-- 20260811150000 renamed free→basic and tightened the check, but left DEFAULT 'free'.
-- On-prem /setup claim that omits plan then inserts DEFAULT 'free' and fails the check.

UPDATE public.restaurants SET plan = 'basic' WHERE plan = 'free' OR plan IS NULL;

ALTER TABLE public.restaurants
  ALTER COLUMN plan SET DEFAULT 'basic';

ALTER TABLE public.restaurants DROP CONSTRAINT IF EXISTS restaurants_plan_check;
ALTER TABLE public.restaurants
  ADD CONSTRAINT restaurants_plan_check CHECK (plan IN ('basic', 'pro'));
