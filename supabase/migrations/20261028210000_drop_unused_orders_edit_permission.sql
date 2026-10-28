-- Remove dead permission key `orders.edit` from stored role permission arrays.
-- Catalog/UI never enforced this key at runtime; normalizeStoredPermissions already
-- drops unknown keys after registry removal — this cleans DB JSON for existing rows.

UPDATE public.restaurant_roles
SET permissions = COALESCE(
  (
    SELECT jsonb_agg(elem ORDER BY ordinality)
    FROM jsonb_array_elements_text(permissions) WITH ORDINALITY AS t(elem, ordinality)
    WHERE elem <> 'orders.edit'
  ),
  '[]'::jsonb
)
WHERE permissions @> '["orders.edit"]'::jsonb;
