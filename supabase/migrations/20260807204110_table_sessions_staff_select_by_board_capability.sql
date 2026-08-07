-- Realtime CDC for table_sessions is gated by SELECT RLS.
-- Old table_sessions_staff_select used is_active_restaurant_staff(restaurant_id)
-- with default roles kitchen|waiter only — frontdesk / custom board roles got
-- subscribe-ok but zero CDC, so always-visible floor boards never refreshed on
-- open/close. Align staff SELECT with configurable role permissions (same keys
-- the board API accepts), not a hardcoded role-name list.

CREATE OR REPLACE FUNCTION public.staff_has_restaurant_permission(
  p_restaurant_id uuid,
  p_permissions text[]
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.restaurant_staff_accounts a
    INNER JOIN public.restaurant_roles rr ON rr.id = a.role_id
    WHERE a.restaurant_id = p_restaurant_id
      AND a.user_id = (SELECT auth.uid())
      AND a.disabled_at IS NULL
      AND rr.disabled_at IS NULL
      AND a.role <> 'print_agent'
      AND EXISTS (
        SELECT 1
        FROM unnest(p_permissions) AS wanted(permission)
        WHERE rr.permissions @> to_jsonb(wanted.permission)
      )
  );
$$;

COMMENT ON FUNCTION public.staff_has_restaurant_permission(uuid, text[]) IS
  'True when the current auth user is an enabled non-print_agent staff account '
  'whose restaurant_roles.permissions contains any of p_permissions. Sole '
  'capability check for staff RLS that must follow configurable permissions.';

REVOKE ALL ON FUNCTION public.staff_has_restaurant_permission(uuid, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_has_restaurant_permission(uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_has_restaurant_permission(uuid, text[]) TO service_role;

DROP POLICY IF EXISTS table_sessions_staff_select ON public.table_sessions;
CREATE POLICY table_sessions_staff_select
  ON public.table_sessions
  FOR SELECT
  TO authenticated
  USING (
    public.staff_has_restaurant_permission(
      restaurant_id,
      ARRAY[
        'dashboard.waiter_board.view',
        'floor.waiter_board.view'
      ]::text[]
    )
  );
