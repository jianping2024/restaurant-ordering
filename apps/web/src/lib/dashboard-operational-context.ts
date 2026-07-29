import { isRestaurantSuspended } from '@mesa/shared';
import type { DashboardAccessResult } from '@/lib/dashboard-access';
import {
  resolveDashboardCapabilityAccess,
} from '@/lib/dashboard-capability-access';
import type { Capabilities } from '@/lib/permissions/can';
import type { PermissionKey } from '@/lib/permissions/registry';

/**
 * Operational dashboard restaurant scope — capability gate only (no access.mode whitelist).
 * Reuses resolveDashboardCapabilityAccess; adds optional suspend check for writes.
 */
export function resolveDashboardOperationalContext(
  access: DashboardAccessResult,
  capabilities: Capabilities | null,
  permission: PermissionKey,
  options?: { requireWritable?: boolean },
): { restaurantId: string } | { error: string; status: number } {
  const gate = resolveDashboardCapabilityAccess(access, capabilities, permission);
  if (!gate.ok) {
    return { error: gate.error, status: gate.status };
  }

  if (
    options?.requireWritable &&
    access.mode !== 'unauthenticated' &&
    access.mode !== 'onboarding' &&
    access.mode !== 'access_error' &&
    isRestaurantSuspended(
      'suspended_at' in access.restaurant ? access.restaurant.suspended_at : null,
    )
  ) {
    return { error: 'restaurant_suspended', status: 403 };
  }

  return { restaurantId: gate.restaurantId };
}
