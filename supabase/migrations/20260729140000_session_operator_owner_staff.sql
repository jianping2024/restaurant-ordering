-- Allow store-owner staff (role = 'owner') as transfer/merge session operators.
-- App auth is capability-based (tables.transfer / tables.merge); this RPC gate
-- must accept the same preset staff roles that can hold those capabilities.

CREATE OR REPLACE FUNCTION public.assert_restaurant_session_operator(
  p_restaurant_id uuid,
  p_operator_user_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  IF p_operator_user_id IS NULL THEN
    RAISE EXCEPTION 'session operator required';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = p_restaurant_id AND r.owner_id = p_operator_user_id
  ) THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.restaurant_staff_accounts a
    WHERE a.restaurant_id = p_restaurant_id
      AND a.user_id = p_operator_user_id
      AND a.disabled_at IS NULL
      AND a.role = ANY (ARRAY['waiter', 'frontdesk', 'cashier', 'owner']::text[])
  ) THEN
    RETURN;
  END IF;

  RAISE EXCEPTION 'invalid session operator';
END;
$$;

REVOKE ALL ON FUNCTION public.assert_restaurant_session_operator(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_restaurant_session_operator(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assert_restaurant_session_operator(uuid, uuid) TO service_role;

COMMENT ON FUNCTION public.assert_restaurant_session_operator(uuid, uuid) IS
  'Transfer/merge operator gate: restaurant owner_id or active staff role in waiter|frontdesk|cashier|owner. Fine-grained tables.transfer/merge is enforced in the app.';
