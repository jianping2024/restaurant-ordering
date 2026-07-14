import type { DashboardAccessMode } from '@/lib/dashboard-access';
import {
  isCashierOperationalPath,
  isDashboardSettingsPath,
  isFrontdeskOperationalPath,
  isOwnerDashboardPath,
} from '@/lib/dashboard-paths';

/** How server-side writes should be performed for this feature. */
export type DashboardWritePattern =
  | 'server-api'
  | 'client-rls'
  | 'server-api-partial'
  | 'read-only';

export type DashboardNavItemKey =
  | 'overview'
  | 'valueAnalytics'
  | 'abnormalOps'
  | 'settings'
  | 'checkout'
  | 'orders'
  | 'tables'
  | 'menu'
  | 'viewWaiter';

export type DashboardNavItemDef = {
  id: string;
  href: string;
  key: DashboardNavItemKey;
  icon: string;
  exact?: boolean;
  matchPrefix?: string;
  /** Show checkout request badge on this nav item. */
  checkoutBadge?: boolean;
  featureId: string;
};

export type DashboardFeature = {
  id: string;
  path: string;
  navRoles: DashboardAccessMode[];
  pageLoader: string;
  writePattern: DashboardWritePattern;
  aliases?: string[];
  riskNote?: string;
};

export const DASHBOARD_NAV_ITEMS: Record<string, DashboardNavItemDef> = {
  overview: {
    id: 'overview',
    href: '/dashboard',
    key: 'overview',
    icon: '📊',
    exact: true,
    featureId: 'overview',
  },
  valueAnalytics: {
    id: 'valueAnalytics',
    href: '/dashboard/value-analytics',
    key: 'valueAnalytics',
    icon: '📈',
    featureId: 'value-analytics',
  },
  abnormalOps: {
    id: 'abnormalOps',
    href: '/dashboard/abnormal-operations',
    key: 'abnormalOps',
    icon: '⚠️',
    featureId: 'abnormal-operations',
  },
  settings: {
    id: 'settings',
    href: '/dashboard/settings',
    key: 'settings',
    icon: '⚙️',
    matchPrefix: '/dashboard/settings',
    featureId: 'settings-profile',
  },
  checkout: {
    id: 'checkout',
    href: '/dashboard/checkout',
    key: 'checkout',
    icon: '💳',
    checkoutBadge: true,
    featureId: 'checkout',
  },
  orders: {
    id: 'orders',
    href: '/dashboard/orders',
    key: 'orders',
    icon: '📋',
    featureId: 'orders',
  },
  tables: {
    id: 'tables',
    href: '/dashboard/tables',
    key: 'tables',
    icon: '🪑',
    featureId: 'tables',
  },
  menu: {
    id: 'menu',
    href: '/dashboard/menu',
    key: 'menu',
    icon: '📋',
    featureId: 'menu',
  },
  waiterBoard: {
    id: 'waiterBoard',
    href: '/dashboard/waiter',
    key: 'viewWaiter',
    icon: '🛎️',
    matchPrefix: '/dashboard/waiter',
    featureId: 'waiter-board',
  },
};

export const OWNER_NAV_ITEM_IDS = [
  'overview',
  'valueAnalytics',
  'abnormalOps',
  'settings',
] as const;

export const FRONTDESK_NAV_ITEM_IDS = [
  'waiterBoard',
  'checkout',
  'orders',
  'overview',
  'tables',
  'menu',
] as const;

export const CASHIER_NAV_ITEM_IDS = ['waiterBoard', 'checkout'] as const;

export function navItemsForRole(role: DashboardAccessMode): DashboardNavItemDef[] {
  const ids =
    role === 'owner'
      ? OWNER_NAV_ITEM_IDS
      : role === 'frontdesk'
        ? FRONTDESK_NAV_ITEM_IDS
        : role === 'cashier'
          ? CASHIER_NAV_ITEM_IDS
          : [];
  return ids.map((id) => DASHBOARD_NAV_ITEMS[id]);
}

/** Whether this dashboard role has the embedded waiter board in its nav (and may open it). */
export function canAccessDashboardWaiterBoard(accessMode: DashboardAccessMode): boolean {
  return navItemsForRole(accessMode).some((item) => item.id === 'waiterBoard');
}

export const OWNER_NAV_PATHS = OWNER_NAV_ITEM_IDS.map((id) => DASHBOARD_NAV_ITEMS[id].href);
export const FRONTDESK_NAV_PATHS = FRONTDESK_NAV_ITEM_IDS.map((id) => DASHBOARD_NAV_ITEMS[id].href);
export const CASHIER_NAV_PATHS = CASHIER_NAV_ITEM_IDS.map((id) => DASHBOARD_NAV_ITEMS[id].href);

/**
 * Canonical dashboard feature access map.
 * Nav order comes from OWNER_NAV_ITEM_IDS / FRONTDESK_NAV_ITEM_IDS / CASHIER_NAV_ITEM_IDS.
 */
export const DASHBOARD_FEATURES: DashboardFeature[] = [
  {
    id: 'overview',
    path: '/dashboard',
    navRoles: ['owner', 'frontdesk'],
    pageLoader: 'loadOverviewDashboardContext',
    writePattern: 'read-only',
  },
  {
    id: 'value-analytics',
    path: '/dashboard/value-analytics',
    navRoles: ['owner'],
    pageLoader: 'loadDashboardAccess (owner only)',
    writePattern: 'read-only',
    aliases: ['/api/analytics/value-overview'],
  },
  {
    id: 'abnormal-operations',
    path: '/dashboard/abnormal-operations',
    navRoles: ['owner'],
    pageLoader: 'loadDashboardAccess (owner only)',
    writePattern: 'server-api',
    aliases: ['/api/dashboard/abnormal-operations'],
  },
  {
    id: 'settings-profile',
    path: '/dashboard/settings',
    navRoles: ['owner'],
    pageLoader: 'owner session + restaurants RLS',
    writePattern: 'server-api',
    aliases: ['/api/restaurant/settings'],
  },
  {
    id: 'settings-staff',
    path: '/dashboard/settings/staff',
    navRoles: ['owner'],
    pageLoader: 'owner session',
    writePattern: 'server-api',
    aliases: ['/api/dashboard/staff'],
  },
  {
    id: 'settings-features',
    path: '/dashboard/settings/features',
    navRoles: ['owner'],
    pageLoader: 'owner session',
    writePattern: 'server-api',
    aliases: ['/api/restaurant/features'],
  },
  {
    id: 'settings-buffet',
    path: '/dashboard/settings/buffet',
    navRoles: ['owner'],
    pageLoader: 'loadWritableOwnerContext',
    writePattern: 'server-api',
    aliases: ['/api/dashboard/buffet'],
  },
  {
    id: 'settings-print-assistant',
    path: '/dashboard/settings/print-assistant',
    navRoles: ['owner'],
    pageLoader: 'getOwnerRestaurantId',
    writePattern: 'server-api',
    aliases: ['/api/print-agent/pairings', '/api/print-agent/settings', '/api/print-agent/devices'],
  },
  {
    id: 'checkout',
    path: '/dashboard/checkout',
    navRoles: ['frontdesk', 'cashier'],
    pageLoader: 'loadDashboardAccess',
    writePattern: 'server-api-partial',
    aliases: [
      '/api/restaurants/[slug]/checkout/apply-discount',
      '/api/restaurants/[slug]/checkout/confirm-payment',
      '/api/dashboard/close-table-session',
    ],
    riskNote: 'Page read uses client bill_splits RLS; confirm-payment allows cashier/waiter/frontdesk + owner.',
  },
  {
    id: 'orders',
    path: '/dashboard/orders',
    navRoles: ['frontdesk'],
    pageLoader: 'loadFrontdeskDashboardTables',
    writePattern: 'read-only',
  },
  {
    id: 'tables',
    path: '/dashboard/tables',
    navRoles: ['frontdesk'],
    pageLoader: 'loadFrontdeskDashboardTables',
    writePattern: 'server-api',
    aliases: ['/api/dashboard/tables', '/api/dashboard/table-groups', '/dashboard/settings/tables'],
  },
  {
    id: 'menu',
    path: '/dashboard/menu',
    navRoles: ['frontdesk'],
    pageLoader: 'loadDashboardMenu (loadMenuManagementContext)',
    writePattern: 'server-api',
    aliases: [
      '/api/dashboard/menu/categories',
      '/api/dashboard/menu/items',
      '/api/dashboard/menu/print-stations',
      '/dashboard/settings/print-stations',
    ],
    riskNote: 'loadMenuManagementContext also allows owner, but middleware blocks owner from this path.',
  },
  {
    id: 'waiter-board',
    path: '/dashboard/waiter',
    navRoles: ['frontdesk', 'cashier'],
    pageLoader: 'loadDashboardAccess (floor staff)',
    writePattern: 'read-only',
    aliases: ['/api/dashboard/checkout-close-table-session'],
    riskNote: 'First item in frontdesk nav; kitchen shortcut stays optional below nav when enabled.',
  },
];

export function canCloseTableFromDashboard(accessMode: DashboardAccessMode): boolean {
  return accessMode === 'owner' || accessMode === 'frontdesk' || accessMode === 'cashier';
}

export function middlewareAllowsPath(role: DashboardAccessMode, pathname: string): boolean {
  if (role === 'owner') return isOwnerDashboardPath(pathname);
  if (role === 'frontdesk') {
    if (isDashboardSettingsPath(pathname)) return false;
    return isFrontdeskOperationalPath(pathname);
  }
  if (role === 'cashier') return isCashierOperationalPath(pathname);
  return false;
}

export function navPathsForRole(role: DashboardAccessMode): readonly string[] {
  if (role === 'owner') return OWNER_NAV_PATHS;
  if (role === 'frontdesk') return FRONTDESK_NAV_PATHS;
  if (role === 'cashier') return CASHIER_NAV_PATHS;
  return [];
}

export function featureByPath(pathname: string): DashboardFeature | undefined {
  return DASHBOARD_FEATURES.find(
    (f) =>
      f.path === pathname ||
      pathname.startsWith(`${f.path}/`) ||
      f.aliases?.some((a) => pathname === a || pathname.startsWith(`${a}/`)),
  );
}
