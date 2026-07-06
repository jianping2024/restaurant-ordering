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
  cashier: ['checkout'],
};

export function dashboardLogoHref(accessMode: DashboardAccessMode): string {
  if (accessMode === 'cashier') return '/dashboard/checkout';
  if (accessMode === 'frontdesk') return '/dashboard/waiter';
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

export function dashboardTopNavPanelClass(): string {
  return 'fixed inset-x-3 top-[calc(3.5rem+4px)] z-50 rounded-xl border border-brand-border bg-brand-card py-2 shadow-lg shadow-black/10 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-1.5 sm:w-64';
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
