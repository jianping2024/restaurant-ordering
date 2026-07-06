SELECT
  paa.display_name,
  paa.role,
  u.email,
  paa.disabled_at,
  paa.created_at
FROM platform_admin_accounts paa
JOIN auth.users u ON u.id = paa.user_id
ORDER BY paa.created_at;