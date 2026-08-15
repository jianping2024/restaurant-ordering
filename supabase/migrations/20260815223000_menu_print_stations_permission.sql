-- Split 出品档口 CRUD from dashboard.menu.view (subset key).
-- Preserve current access: any role that already had menu also gets the stations key.

UPDATE public.restaurant_roles
SET permissions = permissions || '["dashboard.menu.print_stations.manage"]'::jsonb
WHERE permissions @> '["dashboard.menu.view"]'::jsonb
  AND NOT (permissions @> '["dashboard.menu.print_stations.manage"]'::jsonb);
