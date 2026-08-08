import { dashboardMiddlewareRedirectPath } from '@/lib/dashboard-paths';
import { can, type Capabilities } from '@/lib/permissions/can';
import {
  dashboardRoutePermission,
} from '@/lib/permissions/registry';
import { staffLandingPathFromCapabilities } from '@/lib/permissions/resolve';

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
  | 'dishHistory'
  | 'tables'
  | 'menu'
  | 'guestNotice'
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
  dishHistory: {
    id: 'dishHistory',
    href: '/dashboard/dish-history',
    key: 'dishHistory',
    icon: '🔎',
    featureId: 'dish-history',
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
  guestNotice: {
    id: 'guestNotice',
    href: '/dashboard/guest-notice',
    key: 'guestNotice',
    icon: '📢',
    featureId: 'guest-notice',
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

/**
 * Backend-admin (`mode=owner` / restaurants.owner_id) chrome only.
 * Staff nav comes from capabilities + NAV_PERMISSION via buildDashboardTopNavItems.
 * Order here is the owner top-bar order (buildDashboardTopNavItems iterates this list).
 */
export const OWNER_NAV_ITEM_IDS = [
  'overview',
  'valueAnalytics',
  'abnormalOps',
  'menu',
  'settings',
] as const;

/**
 * Canonical dashboard feature access map (paths / loaders).
 * Live UI nav: buildDashboardTopNavItems from capabilities only.
 */
export const DASHBOARD_FEATURES: DashboardFeature[] = [
  {
    id: 'overview',
    path: '/dashboard',
    pageLoader: 'getDashboardOperationalContext (dashboard.overview.view)',
    writePattern: 'read-only',
  },
  {
    id: 'value-analytics',
    path: '/dashboard/value-analytics',
    pageLoader: 'getOwnerAnalyticsContext (dashboard.value_analytics.view)',
    writePattern: 'read-only',
    aliases: ['/api/analytics/value-overview'],
  },
  {
    id: 'abnormal-operations',
    path: '/dashboard/abnormal-operations',
    pageLoader: 'loadOwnerAbnormalOperationsContext (dashboard.abnormal_ops.view)',
    writePattern: 'server-api',
    aliases: ['/api/dashboard/abnormal-operations'],
  },
  {
    id: 'settings-profile',
    path: '/dashboard/settings',
    pageLoader:
      'settings hub: dashboard.settings.view; profile body: settings.profile.manage; else firstAccessibleSettingsChildHref',
    writePattern: 'server-api',
    aliases: ['/api/restaurant/settings'],
  },
  {
    id: 'settings-staff',
    path: '/dashboard/settings/staff',
    pageLoader: 'requireRestaurantForSettingsPermission (settings.staff.manage)',
    writePattern: 'server-api',
    aliases: ['/api/dashboard/staff'],
  },
  {
    id: 'settings-features',
    path: '/dashboard/settings/features',
    pageLoader: 'requireRestaurantForSettingsPermission (settings.features.manage)',
    writePattern: 'server-api',
    aliases: ['/api/restaurant/features'],
  },
  {
    id: 'settings-buffet',
    path: '/dashboard/settings/buffet',
    pageLoader: 'requireRestaurantForSettingsPermission (settings.buffet.manage)',
    writePattern: 'server-api',
    aliases: ['/api/dashboard/buffet'],
  },
  {
    id: 'settings-print-assistant',
    path: '/dashboard/settings/print-assistant',
    pageLoader: 'requireSettingsRestaurantAuth (settings.print_assistant.manage)',
    writePattern: 'server-api',
    aliases: ['/api/print-agent/pairings', '/api/print-agent/settings', '/api/print-agent/devices'],
  },
  {
    id: 'checkout',
    path: '/dashboard/checkout',
    pageLoader: 'loadDashboardAccess',
    writePattern: 'server-api-partial',
    aliases: [
      '/api/restaurants/[slug]/checkout/apply-discount',
      '/api/restaurants/[slug]/checkout/confirm-payment',
      '/api/dashboard/close-table-session',
    ],
    riskNote:
      'Page read uses client bill_splits RLS; confirm-payment is capability-gated. Force-close API: tables.force_close (RPC allows restaurants.owner_id or staff frontdesk|owner).',
  },
  {
    id: 'orders',
    path: '/dashboard/orders',
    pageLoader: 'loadOrderHistoryDashboardContext (dashboard.orders.view)',
    writePattern: 'read-only',
  },
  {
    id: 'dish-history',
    path: '/dashboard/dish-history',
    pageLoader: 'DishHistoryPage (dashboard.dish_history.view)',
    writePattern: 'server-api',
    aliases: [
      '/api/restaurants/[slug]/staff/dish-history',
      '/api/restaurants/[slug]/staff/dish-history/remake',
    ],
  },
  {
    id: 'tables',
    path: '/dashboard/tables',
    pageLoader: 'loadDashboardTables (dashboard.tables.view)',
    writePattern: 'server-api',
    aliases: ['/api/dashboard/tables', '/api/dashboard/table-groups', '/dashboard/settings/tables'],
  },
  {
    id: 'menu',
    path: '/dashboard/menu',
    pageLoader: 'loadDashboardMenu (dashboard.menu.view)',
    writePattern: 'server-api',
    aliases: [
      '/api/dashboard/menu/categories',
      '/api/dashboard/menu/items',
      '/api/dashboard/menu/print-stations',
      '/dashboard/settings/print-stations',
    ],
    riskNote: 'Page gated by dashboard.menu.view; owner chrome includes menu via OWNER_NAV_ITEM_IDS.',
  },
  {
    id: 'guest-notice',
    path: '/dashboard/guest-notice',
    pageLoader: 'resolveDashboardCapabilityAccess (dashboard.guest_notice.view)',
    writePattern: 'server-api',
    aliases: ['/api/dashboard/guest-notice'],
  },
  {
    id: 'waiter-board',
    path: '/dashboard/waiter',
    pageLoader: 'requireWaiterBoardDashboardAccess (resolveWaiterBoardDashboardAccess)',
    writePattern: 'read-only',
    aliases: ['/api/dashboard/checkout-close-table-session'],
    riskNote: 'Floor board via requireWaiterBoardDashboardAccess; close uses resolveCloseTableSessionDeskActor + tables.checkout_close / tables.force_close.',
  },
];

/** Staff dashboard path shell — capability is the only gate. */
export function middlewareAllowsPathForCapabilities(
  capabilities: Capabilities,
  pathname: string,
): boolean {
  const permission = dashboardRoutePermission(pathname);
  if (!permission) return false;
  return can(capabilities, permission);
}

export function pathnameMatchesNavItem(
  pathname: string,
  item: DashboardNavItemDef,
): boolean {
  if (item.matchPrefix) {
    return pathname === item.matchPrefix || pathname.startsWith(`${item.matchPrefix}/`);
  }
  if (item.exact) {
    return pathname === item.href;
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/** Owner restaurants.owner_id path policy. */
export function middlewareAllowsOwnerPath(pathname: string): boolean {
  return dashboardMiddlewareRedirectPath('owner', pathname) === null;
}

/** Redirect staff away from dashboard routes their capabilities do not cover. */
export function dashboardStaffMiddlewareRedirectPath(
  capabilities: Capabilities,
  pathname: string,
  slug: string,
): string | null {
  if (middlewareAllowsPathForCapabilities(capabilities, pathname)) return null;
  return staffLandingPathFromCapabilities(slug, capabilities);
}

export function featureByPath(pathname: string): DashboardFeature | undefined {
  return DASHBOARD_FEATURES.find(
    (f) =>
      f.path === pathname ||
      pathname.startsWith(`${f.path}/`) ||
      f.aliases?.some((a) => pathname === a || pathname.startsWith(`${a}/`)),
  );
}
