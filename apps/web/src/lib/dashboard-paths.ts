export function isDashboardSettingsPath(pathname: string): boolean {
  return pathname === '/dashboard/settings' || pathname.startsWith('/dashboard/settings/');
}

/** Owner-only dashboard routes outside /dashboard/settings (e.g. abnormal operations). */
export function isOwnerOperationalPath(pathname: string): boolean {
  return (
    pathname === '/dashboard/abnormal-operations' ||
    pathname.startsWith('/dashboard/abnormal-operations/') ||
    pathname === '/dashboard/value-analytics' ||
    pathname.startsWith('/dashboard/value-analytics/') ||
    pathname === '/dashboard/guest-notice' ||
    pathname.startsWith('/dashboard/guest-notice/')
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

export type DashboardActor = 'owner' | 'frontdesk' | 'store_owner' | 'cashier' | 'waiter' | 'unknown';

/** Pure redirect target for dashboard middleware (testable). */
export function dashboardMiddlewareRedirectPath(
  actor: DashboardActor,
  pathname: string,
): string | null {
  if (actor === 'owner') {
    if (!isOwnerDashboardPath(pathname)) return '/dashboard/settings';
    return null;
  }
  if (actor === 'frontdesk') {
    if (isDashboardSettingsPath(pathname)) return '/dashboard';
    if (!isFrontdeskOperationalPath(pathname)) return '/dashboard';
    return null;
  }
  if (actor === 'store_owner') {
    if (isDashboardSettingsPath(pathname)) return null;
    if (!isFrontdeskOperationalPath(pathname)) return '/dashboard';
    return null;
  }
  if (actor === 'cashier') {
    if (pathname === '/dashboard' || pathname === '/dashboard/') return '/dashboard/waiter';
    if (!isCashierOperationalPath(pathname)) return '/dashboard/waiter';
    return null;
  }
  if (actor === 'waiter') {
    if (pathname === '/dashboard' || pathname === '/dashboard/') return '/dashboard/waiter';
    if (!isWaiterOperationalPath(pathname)) return '/dashboard/waiter';
    return null;
  }
  return null;
}
