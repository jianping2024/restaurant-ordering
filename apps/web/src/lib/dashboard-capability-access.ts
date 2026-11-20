import type { AuthorizedRestaurantId } from '@/lib/permissions/authorized-restaurant-id';
import type { DashboardAccessResult } from '@/lib/dashboard-access';
import { can, type Capabilities } from '@/lib/permissions/can';
import type { PermissionKey } from '@/lib/permissions/registry';

export type DashboardCapabilityAccessDecision =
  | { ok: true; restaurantId: AuthorizedRestaurantId }
  | { ok: false; error: string; status: number };

/**
 * Pure capability gate for dashboard pages/APIs.
 * No access.mode whitelist — capability alone decides.
 */
export function resolveDashboardCapabilityAccess(
  access: DashboardAccessResult,
  capabilities: Capabilities | null,
  permission: PermissionKey,
): DashboardCapabilityAccessDecision {
  if (access.mode === 'unauthenticated') {
    return { ok: false, error: 'unauthorized', status: 401 };
  }
  if (access.mode === 'forbidden' || access.mode === 'access_error') {
    return { ok: false, error: 'forbidden', status: 403 };
  }
  if (!capabilities || !can(capabilities, permission)) {
    return { ok: false, error: 'forbidden', status: 403 };
  }
  return { ok: true, restaurantId: access.loaded.restaurantId };
}
