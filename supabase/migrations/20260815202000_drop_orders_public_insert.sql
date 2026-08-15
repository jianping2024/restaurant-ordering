-- Guest/staff order writes go only through Next.js admin (service_role).
-- Remove legacy anon/public INSERT policy that allowed PostgREST bypass of /orders/append.
DROP POLICY IF EXISTS orders_public_insert ON public.orders;
DROP POLICY IF EXISTS "orders_public_insert" ON public.orders;
