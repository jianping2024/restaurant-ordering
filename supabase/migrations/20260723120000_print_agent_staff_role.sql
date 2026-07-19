-- System print_agent staff role: Realtime SELECT on print_jobs; one per restaurant.
-- Pin is_active_restaurant_staff definition in-repo (was cloud-only).

CREATE OR REPLACE FUNCTION public.is_active_restaurant_staff(
  p_restaurant_id uuid,
  p_roles text[] DEFAULT ARRAY['kitchen'::text, 'waiter'::text]
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.restaurant_staff_accounts a
    WHERE a.restaurant_id = p_restaurant_id
      AND a.user_id = auth.uid()
      AND a.disabled_at IS NULL
      AND a.role = ANY (p_roles)
  );
$$;

REVOKE ALL ON FUNCTION public.is_active_restaurant_staff(uuid, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_restaurant_staff(uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_restaurant_staff(uuid, text[]) TO service_role;

ALTER TABLE public.restaurant_staff_accounts
  DROP CONSTRAINT IF EXISTS restaurant_staff_accounts_role_check;

ALTER TABLE public.restaurant_staff_accounts
  ADD CONSTRAINT restaurant_staff_accounts_role_check
  CHECK (
    role = ANY (
      ARRAY[
        'kitchen'::text,
        'waiter'::text,
        'cashier'::text,
        'frontdesk'::text,
        'print_agent'::text
      ]
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS restaurant_staff_accounts_one_print_agent_per_restaurant
  ON public.restaurant_staff_accounts (restaurant_id)
  WHERE (role = 'print_agent');

DROP POLICY IF EXISTS "print_jobs_print_agent_select" ON public.print_jobs;
CREATE POLICY "print_jobs_print_agent_select"
  ON public.print_jobs
  FOR SELECT
  TO authenticated
  USING (
    public.is_active_restaurant_staff(restaurant_id, ARRAY['print_agent'::text])
  );
