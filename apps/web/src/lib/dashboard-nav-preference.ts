import type { DashboardAccessMode } from '@/lib/dashboard-access';
import { defaultDashboardNavOpen } from './dashboard-nav-config';

const KEY_PREFIX = 'mesa-dashboard-nav-open:';

export function dashboardNavOpenStorageKey(
  restaurantId: string,
  accessMode: DashboardAccessMode,
): string {
  return `${KEY_PREFIX}${accessMode}:${restaurantId}`;
}

export function loadDashboardNavOpen(
  restaurantId: string,
  accessMode: DashboardAccessMode,
): boolean | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(dashboardNavOpenStorageKey(restaurantId, accessMode));
    if (raw === '1') return true;
    if (raw === '0') return false;
    return null;
  } catch {
    return null;
  }
}

export function saveDashboardNavOpen(
  restaurantId: string,
  accessMode: DashboardAccessMode,
  open: boolean,
): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(dashboardNavOpenStorageKey(restaurantId, accessMode), open ? '1' : '0');
  } catch {
    /* ignore quota / private mode */
  }
}

export function resolveDashboardNavOpen(
  restaurantId: string,
  accessMode: DashboardAccessMode,
): boolean {
  const saved = loadDashboardNavOpen(restaurantId, accessMode);
  if (saved !== null) return saved;
  return defaultDashboardNavOpen(accessMode);
}
