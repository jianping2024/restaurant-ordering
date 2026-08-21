-- Grant checkout.sync_bill to roles that already confirm payment (preserve access).

UPDATE public.restaurant_roles
SET permissions = permissions || '["checkout.sync_bill"]'::jsonb
WHERE permissions @> '["checkout.confirm_payment"]'::jsonb
  AND NOT (permissions @> '["checkout.sync_bill"]'::jsonb);
