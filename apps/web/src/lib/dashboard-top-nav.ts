import type { DashboardAccessMode } from '@/lib/dashboard-access';
import {
  navItemsForRole,
  type DashboardNavItemDef,
} from '@/lib/dashboard-feature-registry';
import type { getMessages } from '@/lib/i18n/messages';

export type DashboardTopNavItem = {
  id: string;
  href: string;
  labelKey: DashboardNavItemDef['key'] | 'viewKitchen';
  icon: string;
  exact?: boolean;
  matchPrefix?: string;
  checkoutBadge?: boolean;
  external?: boolean;
};

export type DashboardTopNavPresentation = {
  all: DashboardTopNavItem[];
  primary: DashboardTopNavItem[];
  overflow: DashboardTopNavItem[];
};

const PRIMARY_NAV_IDS_BY_ROLE: Partial<Record<DashboardAccessMode, readonly string[]>> = {
  owner: ['overview'],
  frontdesk: ['waiterBoard', 'checkout'],
  cashier: ['waiterBoard', 'checkout'],
  waiter: ['waiterBoard'],
};

export function dashboardLogoHref(accessMode: DashboardAccessMode): string {
  if (accessMode === 'cashier' || accessMode === 'frontdesk' || accessMode === 'waiter') {
    return '/dashboard/waiter';
  }
  return '/dashboard';
}

export function dashboardTopNavButtonClass(active: boolean, compact = false): string {
  const tone = active
    ? 'bg-brand-gold/15 text-brand-text border border-brand-gold/35'
    : 'text-brand-text-muted hover:text-brand-text hover:bg-brand-bg/80 border border-transparent';

  if (compact) {
    return `relative inline-flex shrink-0 items-center justify-center rounded-lg min-h-11 min-w-11 text-base font-medium transition-colors ${tone}`;
  }

  return `inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${tone}`;
}

/** Sticky top bar height — keep dropdown top offset in sync. */
export const DASHBOARD_TOP_BAR_HEIGHT = '3.5rem';

export function dashboardTopBarMobileDropdownPanelClass(): string {
  return 'rounded-xl border border-brand-border bg-brand-card py-2 shadow-lg shadow-black/10';
}

export function dashboardTopBarDesktopDropdownPanelClass(): string {
  return 'absolute right-0 top-full z-50 mt-1.5 w-64 rounded-xl border border-brand-border bg-brand-card py-2 shadow-lg shadow-black/10';
}

/** Viewport-safe fixed panel for mobile dashboard dropdowns (portal to body). */
export function dashboardTopBarMobileDropdownPanelStyle(): {
  position: 'fixed';
  top: string;
  right: string;
  width: string;
  maxHeight: string;
  overflowY: 'auto';
  zIndex: number;
} {
  return {
    position: 'fixed',
    top: `calc(${DASHBOARD_TOP_BAR_HEIGHT} + 4px)`,
    right: 'max(12px, env(safe-area-inset-right, 0px))',
    width: 'min(16rem, calc(100vw - 24px))',
    maxHeight: `calc(100dvh - ${DASHBOARD_TOP_BAR_HEIGHT} - 16px - env(safe-area-inset-bottom, 0px))`,
    overflowY: 'auto',
    zIndex: 50,
  };
}

export function isNavItemActive(
  pathname: string,
  item: Pick<DashboardTopNavItem, 'href' | 'exact' | 'matchPrefix'>,
): boolean {
  if (item.matchPrefix) {
    return pathname === item.matchPrefix || pathname.startsWith(`${item.matchPrefix}/`);
  }
  if (item.exact) {
    return pathname === item.href;
  }
  return pathname.startsWith(item.href);
}

export function dashboardTopNavItemLabel(
  item: DashboardTopNavItem,
  navT: ReturnType<typeof getMessages>['nav'],
): string {
  if (item.labelKey === 'viewKitchen') return navT.viewKitchen;
  return navT[item.labelKey as keyof typeof navT] as string;
}

export function buildDashboardTopNavItems(input: {
  accessMode: DashboardAccessMode;
  restaurantSlug: string;
  kitchenShortcutEnabled: boolean;
}): DashboardTopNavItem[] {
  const { accessMode, restaurantSlug, kitchenShortcutEnabled } = input;
  const items: DashboardTopNavItem[] = navItemsForRole(accessMode).map((item) => ({
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

export function buildDashboardTopNavPresentation(input: {
  accessMode: DashboardAccessMode;
  restaurantSlug: string;
  kitchenShortcutEnabled: boolean;
}): DashboardTopNavPresentation {
  const all = buildDashboardTopNavItems(input);
  const primaryIds = new Set(PRIMARY_NAV_IDS_BY_ROLE[input.accessMode] ?? []);
  const primary = all.filter((item) => primaryIds.has(item.id));
  const overflow = all.filter((item) => !primaryIds.has(item.id));
  return { all, primary, overflow };
}

export function isDashboardWaiterBoardListPath(pathname: string): boolean {
  return pathname === '/dashboard/waiter';
}

export function isDashboardWaiterTableDetailPath(pathname: string): boolean {
  return /^\/dashboard\/waiter\/[^/]+$/.test(pathname);
}
