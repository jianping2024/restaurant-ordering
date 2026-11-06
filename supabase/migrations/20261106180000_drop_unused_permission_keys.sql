-- Remove dead permission keys that were never enforced as sole gates:
-- checkout.apply_discount (discount used checkout.confirm_payment)
-- checkout.request_whole_table (checkout.assist_bill was enough)
-- orders.print_receipt (receipt print used checkout.confirm_payment / guest pre-bill)
-- print_agent.manage (print-assistant APIs used settings.print_assistant.manage)
-- normalizeStoredPermissions already drops unknown keys after registry removal;
-- this cleans DB JSON for existing restaurant_roles rows.

UPDATE public.restaurant_roles
SET permissions = COALESCE(
  (
    SELECT jsonb_agg(elem ORDER BY ordinality)
    FROM jsonb_array_elements_text(permissions) WITH ORDINALITY AS t(elem, ordinality)
    WHERE elem NOT IN (
      'checkout.apply_discount',
      'checkout.request_whole_table',
      'orders.print_receipt',
      'print_agent.manage'
    )
  ),
  '[]'::jsonb
)
WHERE permissions ?| ARRAY[
  'checkout.apply_discount',
  'checkout.request_whole_table',
  'orders.print_receipt',
  'print_agent.manage'
];
