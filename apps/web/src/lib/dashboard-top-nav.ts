import type { DashboardAccessMode } from '@/lib/dashboard-access';
import {
  DASHBOARD_NAV_ITEMS,
  navItemsForRole,
  type DashboardNavItemDef,
} from '@/lib/dashboard-feature-registry';
import { SETTINGS_NAV_TABS, type SettingsNavItem } from '@/lib/settings-nav';

export type DashboardTopNavLinkItem = {
  kind: 'link';
  id: string;
  href: string;
  labelKey: DashboardNavItemDef['key'] | 'viewKitchen';
  icon: string;
  exact?: boolean;
  matchPrefix?: string;
  checkoutBadge?: boolean;
  external?: boolean;
};

export type DashboardTopNavDropdownItem = {
  kind: 'dropdown';
  id: 'ownerRestaurantSettings';
  labelKey: 'restaurantSettings';
  icon: string;
  items: SettingsNavItem[];
};

export type DashboardTopNavItem = DashboardTopNavLinkItem | DashboardTopNavDropdownItem;

export function dashboardTopNavButtonClass(active: boolean): string {
  return `inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
    active
      ? 'bg-brand-gold/15 text-brand-text border border-brand-gold/35'
      : 'text-brand-text-muted hover:text-brand-text hover:bg-brand-bg/80 border border-transparent'
  }`;
}

export function isNavItemActive(
  pathname: string,
  item: Pick<DashboardTopNavLinkItem, 'href' | 'exact' | 'matchPrefix'>,
): boolean {
  if (item.matchPrefix) {
    return pathname === item.matchPrefix || pathname.startsWith(`${item.matchPrefix}/`);
  }
  if (item.exact) {
    return pathname === item.href;
  }
  return pathname.startsWith(item.href);
}

export function isOwnerRestaurantSettingsActive(pathname: string): boolean {
  return pathname.startsWith('/dashboard/settings');
}

export function buildDashboardTopNavItems(input: {
  accessMode: DashboardAccessMode;
  restaurantSlug: string;
  kitchenShortcutEnabled: boolean;
}): DashboardTopNavItem[] {
  const { accessMode, restaurantSlug, kitchenShortcutEnabled } = input;
  const items: DashboardTopNavItem[] = navItemsForRole(accessMode)
    .filter((item) => item.id !== 'settings')
    .map((item) => ({
      kind: 'link' as const,
      id: item.id,
      href: item.href,
      labelKey: item.key,
      icon: item.icon,
      exact: item.exact,
      matchPrefix: item.matchPrefix,
      checkoutBadge: item.checkoutBadge,
    }));

  if (accessMode === 'owner') {
    items.push({
      kind: 'dropdown',
      id: 'ownerRestaurantSettings',
      labelKey: 'restaurantSettings',
      icon: DASHBOARD_NAV_ITEMS.settings.icon,
      items: SETTINGS_NAV_TABS,
    });
  }

  if (accessMode === 'frontdesk' && kitchenShortcutEnabled) {
    items.push({
      kind: 'link',
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
