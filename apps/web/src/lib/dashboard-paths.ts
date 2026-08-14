export function isDashboardSettingsPath(pathname: string): boolean {
  return pathname === '/dashboard/settings' || pathname.startsWith('/dashboard/settings/');
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
