import type { DashboardAccessResult } from '@/lib/dashboard-access';
import { can, type Capabilities } from '@/lib/permissions/can';
import { NAV_PERMISSION, type PermissionKey } from '@/lib/permissions/registry';

/** Owner-tool view permissions — same keys as NAV_PERMISSION / DASHBOARD_ROUTE_PERMISSIONS. */
export const OWNER_TOOL_PERMISSIONS = {
  valueAnalytics: NAV_PERMISSION.valueAnalytics,
  abnormalOps: NAV_PERMISSION.abnormalOps,
} as const satisfies Record<string, PermissionKey>;

export type OwnerToolPermission =
  (typeof OWNER_TOOL_PERMISSIONS)[keyof typeof OWNER_TOOL_PERMISSIONS];

export type OwnerToolAccessDecision =
  | { ok: true; restaurantId: string }
  | { ok: false; error: string; status: number };

/**
 * Pure capability gate for value-analytics / abnormal-operations.
 * No access.mode whitelist — capability alone decides.
 */
export function resolveOwnerToolCapabilityAccess(
  access: DashboardAccessResult,
  capabilities: Capabilities | null,
  permission: OwnerToolPermission,
): OwnerToolAccessDecision {
  if (access.mode === 'unauthenticated') {
    return { ok: false, error: 'unauthorized', status: 401 };
  }
  if (access.mode === 'onboarding' || access.mode === 'access_error') {
    return { ok: false, error: 'forbidden', status: 403 };
  }
  if (!capabilities || !can(capabilities, permission)) {
    return { ok: false, error: 'forbidden', status: 403 };
  }
  return { ok: true, restaurantId: access.restaurant.id };
}
