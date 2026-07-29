import { isRestaurantSuspended } from '@mesa/shared';
import type { DashboardAccessMode, DashboardAccessResult } from '@/lib/dashboard-access';

const OPERATIONAL_DASHBOARD_MODES = new Set<DashboardAccessMode>([
  'owner',
  'store_owner',
  'frontdesk',
]);

export function resolveDashboardOperationalContext(
  access: DashboardAccessResult,
  options?: { requireWritable?: boolean },
): { restaurantId: string } | { error: string; status: number } {
  if (access.mode === 'unauthenticated') {
    return { error: 'unauthorized', status: 401 };
  }
  if (
    access.mode === 'access_error' ||
    access.mode === 'onboarding' ||
    access.mode === 'cashier' ||
    access.mode === 'waiter'
  ) {
    return { error: 'forbidden', status: 403 };
  }
  if (!OPERATIONAL_DASHBOARD_MODES.has(access.mode)) {
    return { error: 'forbidden', status: 403 };
  }

  if (
    options?.requireWritable &&
    isRestaurantSuspended(access.restaurant.suspended_at)
  ) {
    return { error: 'restaurant_suspended', status: 403 };
  }

  return { restaurantId: access.restaurant.id };
}
