-- Seed dashboard.operation_logs.view onto frontdesk + owner presets (default product grant).

UPDATE public.restaurant_roles
SET permissions = permissions || '["dashboard.operation_logs.view"]'::jsonb
WHERE preset_key IN ('frontdesk', 'owner')
  AND NOT (permissions @> '["dashboard.operation_logs.view"]'::jsonb);
