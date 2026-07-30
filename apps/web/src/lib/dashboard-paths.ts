export function isDashboardSettingsPath(pathname: string): boolean {
  return pathname === '/dashboard/settings' || pathname.startsWith('/dashboard/settings/');
}

/** Owner dashboard routes outside /dashboard/settings (value analytics, abnormal ops). */
export function isOwnerOperationalPath(pathname: string): boolean {
  return (
    pathname === '/dashboard/abnormal-operations' ||
    pathname.startsWith('/dashboard/abnormal-operations/') ||
    pathname === '/dashboard/value-analytics' ||
    pathname.startsWith('/dashboard/value-analytics/')
  );
}

export function isOwnerOverviewPath(pathname: string): boolean {
  return pathname === '/dashboard' || pathname === '/dashboard/';
}

const SETTINGS_HEAVY_TAB_PREFIXES = [
  '/dashboard/settings/buffet',
  '/dashboard/settings/print-assistant',
] as const;

/** Heavy RSC routes — do not Link-prefetch from dashboard or settings hub nav. */
export function shouldPrefetchDashboardNav(href: string): boolean {
  if (href === '/dashboard/value-analytics' || href.startsWith('/dashboard/value-analytics/')) {
    return false;
  }
  if (SETTINGS_HEAVY_TAB_PREFIXES.some((prefix) => href === prefix || href.startsWith(`${prefix}/`))) {
    return false;
  }
  return true;
}

export function isOwnerDashboardPath(pathname: string): boolean {
  return (
    isOwnerOverviewPath(pathname) ||
    isDashboardSettingsPath(pathname) ||
    isOwnerOperationalPath(pathname)
  );
}

export function isCashierCheckoutPath(pathname: string): boolean {
  return pathname === '/dashboard/checkout' || pathname.startsWith('/dashboard/checkout/');
}

export function isDashboardWaiterBoardPath(pathname: string): boolean {
  return pathname === '/dashboard/waiter' || pathname.startsWith('/dashboard/waiter/');
}

/** Cashier dashboard routes: embedded waiter board + checkout (no admin pages). */
export function isCashierOperationalPath(pathname: string): boolean {
  return isDashboardWaiterBoardPath(pathname) || isCashierCheckoutPath(pathname);
}

/** Waiter dashboard routes: floor board only. */
export function isWaiterOperationalPath(pathname: string): boolean {
  return isDashboardWaiterBoardPath(pathname);
}

export function isFrontdeskOperationalPath(pathname: string): boolean {
  if (!pathname.startsWith('/dashboard')) return false;
  if (isDashboardSettingsPath(pathname)) return false;
  return true;
}

/** Backend admin (`restaurants.owner_id`) middleware actor only. */
export type DashboardActor = 'owner';

/** Redirect restaurants.owner_id away from staff operational dashboard routes. */
export function dashboardMiddlewareRedirectPath(
  actor: DashboardActor,
  pathname: string,
): string | null {
  if (actor !== 'owner') return null;
  if (!isOwnerDashboardPath(pathname)) return '/dashboard/settings';
  return null;
}
