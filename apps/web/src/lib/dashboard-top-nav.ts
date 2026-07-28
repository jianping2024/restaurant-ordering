import type { DashboardAccessMode } from '@/lib/dashboard-access';
import { navItemsForRole } from '@/lib/dashboard-feature-registry';
import type { getMessages } from '@/lib/i18n/messages';
import { parseTableIdParam } from '@/lib/restaurant-tables';
import { STAFF_TOP_BAR_TOTAL_HEIGHT } from '@/lib/waiter-staff-sticky-chrome';

export type ProductTopNavItem = {
  id: string;
  href: string;
  labelKey: string;
  icon: string;
  exact?: boolean;
  matchPrefix?: string;
  checkoutBadge?: boolean;
  external?: boolean;
};

/** @deprecated Use ProductTopNavItem */
export type DashboardTopNavItem = ProductTopNavItem;

/** @deprecated Use ProductTopNavItem */
export type StaffPersonalTopNavItem = ProductTopNavItem;

/** Matches Tailwind `lg` — collapse nav into hamburger menu below this width. */
export const STAFF_TOP_BAR_COLLAPSED_NAV_MQ = '(max-width: 1023px)';

export function dashboardLogoHref(accessMode: DashboardAccessMode): string {
  if (accessMode === 'cashier' || accessMode === 'frontdesk' || accessMode === 'waiter') {
    return '/dashboard/waiter';
  }
  return '/dashboard';
}

export function isTopBarLogoHrefActive(
  pathname: string,
  logoHref: string,
  exact = false,
): boolean {
  if (exact) return pathname === logoHref;
  return pathname === logoHref || pathname.startsWith(`${logoHref}/`);
}

export function isLogoHrefActive(pathname: string, accessMode: DashboardAccessMode): boolean {
  const href = dashboardLogoHref(accessMode);
  return isTopBarLogoHrefActive(pathname, href, accessMode === 'owner');
}

/** Icon trigger aligned to the staff top-bar row — no pill chrome. */
export function topNavIconTriggerClass(open: boolean): string {
  return `relative inline-flex h-full min-w-11 shrink-0 items-center justify-center px-2 text-lg leading-none transition-colors ${
    open ? 'text-brand-text' : 'text-brand-text-muted hover:text-brand-text'
  }`;
}

/** Account / role menu trigger — text label, same row alignment, no pill chrome. */
export function topNavAccountTriggerClass(open: boolean): string {
  return `inline-flex h-full max-w-[5.5rem] shrink-0 items-center gap-0.5 px-2 text-sm font-medium transition-colors ${
    open ? 'text-brand-text' : 'text-brand-text-muted hover:text-brand-text'
  }`;
}

/** @deprecated Use topNavIconTriggerClass */
export function topNavMenuTriggerClass(open: boolean): string {
  return topNavIconTriggerClass(open);
}

/** Desktop horizontal nav — text links inside `mesa-chip-scroll`. */
export function topNavDesktopLinkClass(active: boolean): string {
  return active
    ? 'shrink-0 whitespace-nowrap text-sm font-semibold text-brand-text underline decoration-brand-gold/60 underline-offset-4'
    : 'shrink-0 whitespace-nowrap text-sm font-medium text-brand-text-muted transition-colors hover:text-brand-text';
}

/** Staff top bar: horizontal nav strip (lg+); hamburger below lg. */
export function topNavDesktopScrollNavClassName(): string {
  return 'mesa-chip-scroll hidden min-h-full min-w-0 flex-1 items-center lg:flex';
}

export function topNavMenuRowClass(active: boolean): string {
  return `flex min-h-11 w-full items-center gap-2 px-3 py-2.5 text-sm transition-colors ${
    active
      ? 'bg-brand-gold/10 text-brand-text border-l-2 border-brand-gold font-medium'
      : 'text-brand-text hover:bg-brand-bg/80 border-l-2 border-transparent'
  }`;
}

export function dashboardTopBarMobileDropdownPanelClass(): string {
  return 'rounded-xl border border-brand-border bg-brand-card py-2 shadow-lg shadow-black/10';
}

export type TopBarDropdownAlign = 'start' | 'end';

export function dashboardTopBarDesktopDropdownPanelClass(
  align: TopBarDropdownAlign = 'start',
): string {
  const edge = align === 'end' ? 'right-0' : 'left-0';
  return `absolute ${edge} top-full z-50 mt-1.5 w-64 rounded-xl border border-brand-border bg-brand-card py-2 shadow-lg shadow-black/10`;
}

/** Viewport-safe fixed panel for mobile staff top-bar dropdowns (portal to body). */
export function dashboardTopBarMobileDropdownPanelStyle(): {
  position: 'fixed';
  top: string;
  left: string;
  width: string;
  maxHeight: string;
  overflowY: 'auto';
  zIndex: number;
} {
  return {
    position: 'fixed',
    top: `calc(${STAFF_TOP_BAR_TOTAL_HEIGHT} + 4px)`,
    left: 'max(0.5rem, env(safe-area-inset-left, 0px))',
    width: 'min(16rem, calc(100vw - 24px))',
    maxHeight: `calc(100dvh - (${STAFF_TOP_BAR_TOTAL_HEIGHT}) - 16px - env(safe-area-inset-bottom, 0px))`,
    overflowY: 'auto',
    zIndex: 50,
  };
}

export function isNavItemActive(
  pathname: string,
  item: Pick<ProductTopNavItem, 'href' | 'exact' | 'matchPrefix'>,
): boolean {
  if (item.matchPrefix) {
    return pathname === item.matchPrefix || pathname.startsWith(`${item.matchPrefix}/`);
  }
  if (item.exact) {
    return pathname === item.href;
  }
  return pathname.startsWith(item.href);
}

export function topNavItemLabel(
  item: Pick<ProductTopNavItem, 'labelKey'>,
  navT: ReturnType<typeof getMessages>['nav'],
): string {
  if (item.labelKey === 'viewKitchen') return navT.viewKitchen;
  const key = item.labelKey as keyof typeof navT;
  return typeof navT[key] === 'string' ? (navT[key] as string) : item.labelKey;
}

/** @deprecated Use topNavItemLabel */
export const dashboardTopNavItemLabel = topNavItemLabel;

export function buildDashboardTopNavItems(input: {
  accessMode: DashboardAccessMode;
  restaurantSlug: string;
  kitchenShortcutEnabled: boolean;
}): ProductTopNavItem[] {
  const { accessMode, restaurantSlug, kitchenShortcutEnabled } = input;
  const items: ProductTopNavItem[] = navItemsForRole(accessMode).map((item) => ({
    id: item.id,
    href: item.href,
    labelKey: item.key,
    icon: item.icon,
    exact: item.exact,
    matchPrefix: item.matchPrefix,
    checkoutBadge: item.checkoutBadge,
  }));

  if (accessMode === 'frontdesk' && kitchenShortcutEnabled) {
    items.push({
      id: 'kitchenBoard',
      href: `/${restaurantSlug}/kitchen`,
      labelKey: 'viewKitchen',
      icon: '🍳',
      external: true,
    });
  }

  return items;
}

export function isDashboardWaiterBoardListPath(pathname: string): boolean {
  return pathname === '/dashboard/waiter';
}

export function isDashboardWaiterTableDetailPath(pathname: string): boolean {
  return /^\/dashboard\/waiter\/[^/]+$/.test(pathname);
}

/** Table UUID from `/dashboard/waiter/[tableId]` — null when path or id is invalid. */
export function dashboardWaiterTableIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/dashboard\/waiter\/([^/]+)$/);
  if (!match?.[1]) return null;
  try {
    return parseTableIdParam(decodeURIComponent(match[1]));
  } catch {
    return null;
  }
}
