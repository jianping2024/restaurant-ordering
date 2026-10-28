import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * System preset keys seeded per restaurant (not custom).
 * Default permission sets are frozen from Pirata on-prem (pirata-ms8khtls, 2026-10-28).
 */
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
 * Sole default permission matrix for new restaurants +「恢复默认」.
 * Source: Pirata live `restaurant_roles.permissions` for each preset_key.
 */
export const ROLE_TEMPLATES: Record<RolePresetKey, readonly string[]> = {
  kitchen: ['floor.kitchen_board.view', 'orders.kitchen_update'],
  waiter: [
    'dashboard.waiter_board.view',
    'orders.append',
    'orders.print_receipt',
    'tables.open_session',
    'tables.transfer',
  ],
  cashier: [
    'checkout.apply_discount',
    'checkout.assist_bill',
    'checkout.confirm_payment',
    'checkout.open_pending_tables',
    'checkout.sync_bill',
    'dashboard.checkout.view',
    'dashboard.waiter_board.dining_headcount.view',
    'dashboard.waiter_board.table_detail_amounts.view',
    'dashboard.waiter_board.view',
    'orders.append',
    'orders.menu_decrement',
    'orders.print_receipt',
    'print_agent.receipt_printers.read',
    'tables.checkout_close',
    'tables.force_close',
    'tables.manage',
    'tables.merge',
    'tables.open_session',
    'tables.transfer',
  ],
  frontdesk: [
    'checkout.apply_discount',
    'checkout.assist_bill',
    'checkout.confirm_payment',
    'checkout.open_pending_tables',
    'checkout.print_pre_bill',
    'checkout.request_whole_table',
    'checkout.sync_bill',
    'dashboard.checkout.view',
    'dashboard.guest_notice.view',
    'dashboard.menu.view',
    'dashboard.operation_logs.view',
    'dashboard.orders.view',
    'dashboard.tables.view',
    'dashboard.waiter_board.dining_headcount.view',
    'dashboard.waiter_board.table_detail_amounts.view',
    'dashboard.waiter_board.view',
    'orders.append',
    'orders.menu_decrement',
    'orders.print_receipt',
    'print_agent.receipt_printers.read',
    'tables.checkout_close',
    'tables.force_close',
    'tables.manage',
    'tables.merge',
    'tables.open_session',
    'tables.transfer',
  ],
  owner: [
    'dashboard.abnormal_ops.view',
    'dashboard.operation_logs.view',
    'dashboard.orders.view',
    'dashboard.overview.view',
    'dashboard.settings.view',
    'dashboard.value_analytics.view',
    'settings.buffet.manage',
    'settings.features.manage',
    'settings.profile.manage',
    'settings.staff.manage',
  ],
};

export function templatePermissions(preset: RolePresetKey): string[] {
  return [...ROLE_TEMPLATES[preset]];
}

/** Ensure five preset roles exist (idempotent insert of missing presets only). */
export async function ensureRestaurantPresetRoles(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<void> {
  const { data: existing, error } = await admin
    .from('restaurant_roles')
    .select('preset_key')
    .eq('restaurant_id', restaurantId)
    .not('preset_key', 'is', null);

  if (error) throw new Error(error.message);

  const have = new Set(
    (existing ?? [])
      .map((r) => r.preset_key as string | null)
      .filter((k): k is string => Boolean(k)),
  );

  const inserts = ROLE_PRESET_KEYS.filter((key) => !have.has(key)).map((key, index) => ({
    restaurant_id: restaurantId,
    name: ROLE_PRESET_DEFAULT_NAMES[key],
    preset_key: key,
    permissions: templatePermissions(key),
    sort_order: index,
  }));

  if (inserts.length === 0) return;

  const { error: insertError } = await admin.from('restaurant_roles').insert(inserts);
  if (insertError) throw new Error(insertError.message);
}
