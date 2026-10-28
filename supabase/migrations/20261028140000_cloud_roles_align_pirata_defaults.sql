-- Align cloud restaurant preset role permissions to Pirata on-prem defaults
-- (pirata-ms8khtls live dump 2026-10-28). Custom roles (preset_key IS NULL) untouched.
-- Sole product default matrix: packages/shared ROLE_TEMPLATES — keep in sync.

CREATE TEMP TABLE _pirata_role_defaults (
  preset_key text PRIMARY KEY,
  name text NOT NULL,
  permissions jsonb NOT NULL,
  sort_order integer NOT NULL
) ON COMMIT DROP;

INSERT INTO _pirata_role_defaults (preset_key, name, permissions, sort_order) VALUES
  (
    'kitchen',
    '厨房',
    '["floor.kitchen_board.view","orders.kitchen_update"]'::jsonb,
    0
  ),
  (
    'waiter',
    '服务员',
    '["dashboard.waiter_board.view","orders.append","orders.edit","orders.print_receipt","tables.open_session","tables.transfer"]'::jsonb,
    1
  ),
  (
    'cashier',
    '收银员',
    '["checkout.apply_discount","checkout.assist_bill","checkout.confirm_payment","checkout.open_pending_tables","checkout.sync_bill","dashboard.checkout.view","dashboard.waiter_board.dining_headcount.view","dashboard.waiter_board.table_detail_amounts.view","dashboard.waiter_board.view","orders.append","orders.edit","orders.menu_decrement","orders.print_receipt","print_agent.receipt_printers.read","tables.checkout_close","tables.force_close","tables.manage","tables.merge","tables.open_session","tables.transfer"]'::jsonb,
    2
  ),
  (
    'frontdesk',
    '前台',
    '["checkout.apply_discount","checkout.assist_bill","checkout.confirm_payment","checkout.open_pending_tables","checkout.print_pre_bill","checkout.request_whole_table","checkout.sync_bill","dashboard.checkout.view","dashboard.guest_notice.view","dashboard.menu.view","dashboard.operation_logs.view","dashboard.orders.view","dashboard.tables.view","dashboard.waiter_board.dining_headcount.view","dashboard.waiter_board.table_detail_amounts.view","dashboard.waiter_board.view","orders.append","orders.edit","orders.menu_decrement","orders.print_receipt","print_agent.receipt_printers.read","tables.checkout_close","tables.force_close","tables.manage","tables.merge","tables.open_session","tables.transfer"]'::jsonb,
    3
  ),
  (
    'owner',
    '店主',
    '["dashboard.abnormal_ops.view","dashboard.operation_logs.view","dashboard.orders.view","dashboard.overview.view","dashboard.settings.view","dashboard.value_analytics.view","settings.buffet.manage","settings.features.manage","settings.profile.manage","settings.staff.manage"]'::jsonb,
    5
  );

INSERT INTO public.restaurant_roles (restaurant_id, name, preset_key, permissions, sort_order)
SELECT
  r.id,
  d.name,
  d.preset_key,
  d.permissions,
  d.sort_order
FROM public.restaurants r
CROSS JOIN _pirata_role_defaults d
WHERE r.deployment_mode = 'cloud'
  AND NOT EXISTS (
    SELECT 1
    FROM public.restaurant_roles rr
    WHERE rr.restaurant_id = r.id
      AND rr.preset_key = d.preset_key
  );

UPDATE public.restaurant_roles rr
SET
  permissions = d.permissions,
  updated_at = now()
FROM public.restaurants r
JOIN _pirata_role_defaults d ON true
WHERE rr.restaurant_id = r.id
  AND r.deployment_mode = 'cloud'
  AND rr.preset_key = d.preset_key
  AND rr.permissions IS DISTINCT FROM d.permissions;

UPDATE public.restaurants r
SET permissions_version = permissions_version + 1
WHERE r.deployment_mode = 'cloud'
  AND EXISTS (
    SELECT 1
    FROM public.restaurant_roles rr
    WHERE rr.restaurant_id = r.id
      AND rr.preset_key IS NOT NULL
  );
