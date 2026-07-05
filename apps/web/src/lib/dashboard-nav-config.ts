import type { DashboardAccessMode } from '@/lib/dashboard-access';

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
