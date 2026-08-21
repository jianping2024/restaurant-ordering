import {
  ALL_PERMISSION_KEYS,
  type PermissionKey,
} from '@/lib/permissions/registry';

/** System preset keys seeded per restaurant (not custom). */
export const ROLE_PRESET_KEYS = ['kitchen', 'waiter', 'cashier', 'frontdesk', 'owner'] as const;
export type RolePresetKey = (typeof ROLE_PRESET_KEYS)[number];

export function isRolePresetKey(value: string): value is RolePresetKey {
  return (ROLE_PRESET_KEYS as readonly string[]).includes(value);
}

/** Default display names (zh) for seeded presets — owner may rename. */
export const ROLE_PRESET_DEFAULT_NAMES: Record<RolePresetKey, string> = {
  kitchen: '厨房',
  waiter: '服务员',
  cashier: '收银员',
  frontdesk: '前台',
  owner: '店主',
};

/**
 * Default permission sets aligned with current production behavior (2026-07).
 * Seeded onto restaurant_roles.permissions; edits overwrite the full array (one representation).
 */
export const ROLE_TEMPLATES: Record<RolePresetKey, readonly PermissionKey[]> = {
  kitchen: [
    'floor.kitchen_board.view',
    'orders.kitchen_update',
  ],
  waiter: [
    'dashboard.waiter_board.view',
    'dashboard.dish_history.view',
    'tables.open_session',
    'tables.transfer',
    'tables.merge',
    'orders.append',
    'orders.edit',
    'orders.serve_to_table',
    'orders.print_receipt',
  ],
  cashier: [
    'dashboard.waiter_board.view',
    'dashboard.checkout.view',
    'checkout.confirm_payment',
    'checkout.apply_discount',
    'checkout.assist_bill',
    'checkout.open_pending_tables',
    'checkout.sync_bill',
    'print_agent.receipt_printers.read',
    'tables.open_session',
    'tables.checkout_close',
    'tables.transfer',
    'tables.merge',
    'orders.append',
    'orders.edit',
    'orders.menu_decrement',
    'orders.print_receipt',
  ],
  frontdesk: [
    'dashboard.overview.view',
    'dashboard.checkout.view',
    'dashboard.orders.view',
    'dashboard.tables.view',
    'dashboard.menu.view',
    'dashboard.menu.print_stations.manage',
    'dashboard.waiter_board.view',
    'floor.kitchen_board.view',
    'dashboard.guest_notice.view',
    'dashboard.dish_history.view',
    'dashboard.operation_logs.view',
    'checkout.confirm_payment',
    'checkout.apply_discount',
    'checkout.request_whole_table',
    'checkout.assist_bill',
    'checkout.print_pre_bill',
    'checkout.open_pending_tables',
    'checkout.sync_bill',
    'print_agent.receipt_printers.read',
    'tables.manage',
    'tables.open_session',
    'tables.checkout_close',
    'tables.force_close',
    'tables.transfer',
    'tables.merge',
    'orders.append',
    'orders.edit',
    'orders.menu_decrement',
    'orders.serve_to_table',
    'orders.print_receipt',
    'floor.kitchen_screens.manage',
  ],
  owner: [
    'dashboard.overview.view',
    'dashboard.checkout.view',
    'dashboard.orders.view',
    'dashboard.tables.view',
    'dashboard.menu.view',
    'dashboard.menu.print_stations.manage',
    'dashboard.waiter_board.view',
    'floor.kitchen_board.view',
    'dashboard.dish_history.view',
    'checkout.confirm_payment',
    'checkout.apply_discount',
    'checkout.request_whole_table',
    'checkout.assist_bill',
    'checkout.print_pre_bill',
    'checkout.open_pending_tables',
    'checkout.sync_bill',
    'print_agent.receipt_printers.read',
    'tables.manage',
    'tables.open_session',
    'tables.checkout_close',
    'tables.force_close',
    'tables.transfer',
    'tables.merge',
    'orders.append',
    'orders.edit',
    'orders.menu_decrement',
    'orders.serve_to_table',
    'orders.print_receipt',
    'floor.kitchen_screens.manage',
    'dashboard.settings.view',
    'settings.profile.manage',
    'settings.staff.manage',
    'dashboard.value_analytics.view',
    'dashboard.abnormal_ops.view',
    'dashboard.operation_logs.view',
  ],
};

export function templatePermissions(preset: RolePresetKey): PermissionKey[] {
  return [...ROLE_TEMPLATES[preset]];
}

export function assertTemplateKeysValid(): void {
  const known = new Set(ALL_PERMISSION_KEYS);
  for (const preset of ROLE_PRESET_KEYS) {
    for (const key of ROLE_TEMPLATES[preset]) {
      if (!known.has(key)) {
        throw new Error(`ROLE_TEMPLATES[${preset}] unknown key: ${key}`);
      }
    }
  }
}
