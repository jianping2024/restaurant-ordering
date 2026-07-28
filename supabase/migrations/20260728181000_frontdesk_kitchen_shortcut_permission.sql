-- Add kitchen shortcut capability to frontdesk preset roles (already seeded).
UPDATE public.restaurant_roles
SET
  permissions = permissions || '["dashboard.kitchen_shortcut.view"]'::jsonb,
  updated_at = now()
WHERE preset_key = 'frontdesk'
  AND NOT (permissions ? 'dashboard.kitchen_shortcut.view');
