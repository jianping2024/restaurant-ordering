-- Seed dashboard.guest_notice.view onto frontdesk presets only (default product grant).

UPDATE public.restaurant_roles
SET permissions = permissions || '["dashboard.guest_notice.view"]'::jsonb
WHERE preset_key = 'frontdesk'
  AND NOT (permissions @> '["dashboard.guest_notice.view"]'::jsonb);
