SELECT
  id,
  login_name,
  user_id,
  role,
  display_name,
  disabled_at,
  restaurant_id,
  created_at,
  updated_at
FROM public.restaurant_staff_accounts
WHERE login_name = 'qiantai';