import type { DashboardAccessMode } from '@/lib/dashboard-access';
import { navItemsForRole } from './dashboard-feature-registry';

/** Role default before any saved user preference. */
export function defaultDashboardNavOpen(accessMode: DashboardAccessMode): boolean {
  return accessMode === 'owner';
}

/** Owner desktop with nav open uses docked sidebar; operational roles always use drawer. */
export function isDashboardNavDocked(
  accessMode: DashboardAccessMode,
  navOpen: boolean,
  isLargeScreen: boolean,
): boolean {
  return accessMode === 'owner' && navOpen && isLargeScreen;
}

/** Whether this dashboard role has the embedded waiter board in its nav (and may open it). */
export function canAccessDashboardWaiterBoard(accessMode: DashboardAccessMode): boolean {
  return navItemsForRole(accessMode).some((item) => item.id === 'waiterBoard');
}
