import type { DashboardAccessMode } from '@/lib/dashboard-access';
import {
  navItemsForRole,
  type DashboardNavItemDef,
} from '@/lib/dashboard-feature-registry';

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

export function dashboardTopNavButtonClass(active: boolean): string {
  return `inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
    active
      ? 'bg-brand-gold/15 text-brand-text border border-brand-gold/35'
      : 'text-brand-text-muted hover:text-brand-text hover:bg-brand-bg/80 border border-transparent'
  }`;
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

export function isDashboardWaiterBoardListPath(pathname: string): boolean {
  return pathname === '/dashboard/waiter';
}

export function isDashboardWaiterTableDetailPath(pathname: string): boolean {
  return /^\/dashboard\/waiter\/[^/]+$/.test(pathname);
}
