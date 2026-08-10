import { can, capabilitiesFromKeys, type Capabilities } from '@/lib/permissions/can';
import type { PermissionKey } from '@/lib/permissions/registry';
import { isPermissionKey } from '@/lib/permissions/registry';
import type { PermissionDef } from '@/lib/permissions/registry';
import { PERMISSIONS } from '@/lib/permissions/registry';
import { templatePermissions } from '@/lib/permissions/role-templates';

/**
 * Retired keys → sole live PermissionKey (one representation after normalize).
 * DB migration rewrites rows; this keeps unread/unsaved arrays coherent.
 */
const LEGACY_PERMISSION_ALIASES: Record<string, PermissionKey> = {
  'buffet.post_to_table': 'tables.open_session',
  'floor.waiter_board.view': 'dashboard.waiter_board.view',
  'dashboard.kitchen_shortcut.view': 'floor.kitchen_board.view',
};

/** Parse DB jsonb/text[] into a clean PermissionKey list (unknown keys dropped; legacy aliased). */
export function normalizeStoredPermissions(raw: unknown): PermissionKey[] {
  if (!Array.isArray(raw)) return [];
  const out: PermissionKey[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const mapped = LEGACY_PERMISSION_ALIASES[item] ?? item;
    if (!isPermissionKey(mapped) || seen.has(mapped)) continue;
    seen.add(mapped);
    out.push(mapped);
  }
  return out;
}

/** Ensure requires[] deps are present when saving a permission set. */
export function enforcePermissionRequires(keys: readonly PermissionKey[]): PermissionKey[] {
  const set = new Set<PermissionKey>(keys);
  let changed = true;
  while (changed) {
    changed = false;
    for (const key of Array.from(set)) {
      const def = PERMISSIONS[key] as PermissionDef;
      const requires = def.requires;
      if (!requires) continue;
      for (const dep of requires) {
        if (isPermissionKey(dep) && !set.has(dep)) {
          set.add(dep);
          changed = true;
        }
      }
    }
  }
  return Array.from(set);
}

export function resolveCapabilitiesForOwner(): Capabilities {
  // Restaurant owner (mode=owner): store-owner template + backend-admin settings keys.
  return capabilitiesFromKeys([
    ...templatePermissions('owner'),
    'settings.roles.manage',
    'settings.features.manage',
    'settings.buffet.manage',
    'settings.print_assistant.manage',
  ]);
}

export function resolveCapabilitiesFromRolePermissions(
  permissions: readonly PermissionKey[],
): Capabilities {
  return new Set(permissions);
}

/** Floor-board UI flags derived only from capabilities (no role switch). */
export type FloorBoardCapabilities = {
  canMenuDecrement: boolean;
  canCheckoutClose: boolean;
  canAssistBillCheckout: boolean;
  canOpenCheckoutPendingTables: boolean;
  canPrintSessionPreBill: boolean;
  /** Print total bill when running 关台结账 (frontdesk default; cashier false). */
  canPrintOnCheckoutClose: boolean;
  canTransfer: boolean;
  canMerge: boolean;
  /** Unpaid / force close (关台); not settled 关台结账. */
  canForceClose: boolean;
  /** 开台 / 保存人数 on table detail — sole tables.open_session. */
  canOpenTableSession: boolean;
};

export function mayForceCloseFromCaps(capabilities: Capabilities): boolean {
  return can(capabilities, 'tables.force_close');
}

export function floorBoardCapabilitiesFromCaps(capabilities: Capabilities): FloorBoardCapabilities {
  return {
    canMenuDecrement: can(capabilities, 'orders.menu_decrement'),
    canCheckoutClose: can(capabilities, 'tables.checkout_close'),
    canAssistBillCheckout: can(capabilities, 'checkout.assist_bill'),
    canOpenCheckoutPendingTables: can(capabilities, 'checkout.open_pending_tables'),
    canPrintSessionPreBill: can(capabilities, 'checkout.print_pre_bill'),
    canPrintOnCheckoutClose: can(capabilities, 'checkout.print_pre_bill'),
    canTransfer: can(capabilities, 'tables.transfer'),
    canMerge: can(capabilities, 'tables.merge'),
    canForceClose: mayForceCloseFromCaps(capabilities),
    canOpenTableSession: can(capabilities, 'tables.open_session'),
  };
}

/** First dashboard/floor landing path for a staff capability set. */
export function staffLandingPathFromCapabilities(
  slug: string,
  capabilities: Capabilities,
): string {
  if (can(capabilities, 'dashboard.waiter_board.view')) return '/dashboard/waiter';
  if (can(capabilities, 'dashboard.checkout.view')) return '/dashboard/checkout';
  if (can(capabilities, 'dashboard.overview.view')) return '/dashboard';
  if (can(capabilities, 'dashboard.orders.view')) return '/dashboard/orders';
  if (can(capabilities, 'dashboard.tables.view')) return '/dashboard/tables';
  if (can(capabilities, 'dashboard.menu.view')) return '/dashboard/menu';
  if (can(capabilities, 'dashboard.settings.view')) return '/dashboard/settings';
  if (can(capabilities, 'floor.kitchen_board.view')) return `/${slug}/kitchen`;
  return '/dashboard/waiter';
}
