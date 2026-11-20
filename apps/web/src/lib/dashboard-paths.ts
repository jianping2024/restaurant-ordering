import { dashboardPageMatches, dashboardStorePage } from '@/lib/dashboard-store-routes';

/** Store dashboard pathname predicates — input is a full pathname (`/dashboard/r/{slug}/…`). */
function pageUnder(pathname: string, prefix: string): boolean {
  const page = dashboardStorePage(pathname);
  return page != null && dashboardPageMatches(page, prefix);
}

export function isDashboardSettingsPath(pathname: string): boolean {
  return pageUnder(pathname, '/settings');
}

const SETTINGS_HEAVY_TAB_PAGES = ['/settings/buffet', '/settings/print-assistant'] as const;

/** Heavy RSC routes — do not Link-prefetch from dashboard or settings hub nav. */
export function shouldPrefetchDashboardNav(href: string): boolean {
  if (pageUnder(href.split('?')[0] ?? '', '/value-analytics')) return false;
  if (SETTINGS_HEAVY_TAB_PAGES.some((page) => pageUnder(href.split('?')[0] ?? '', page))) {
    return false;
  }
  return true;
}

export function isCashierCheckoutPath(pathname: string): boolean {
  return pageUnder(pathname, '/checkout');
}

export function isDashboardWaiterBoardPath(pathname: string): boolean {
  return pageUnder(pathname, '/waiter');
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
  if (dashboardStorePage(pathname) == null) return false;
  return !isDashboardSettingsPath(pathname);
}
