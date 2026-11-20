import { can, type Capabilities } from '@/lib/permissions/can';
import { dashboardPageMatches, type DashboardPagePath } from '@/lib/dashboard-store-routes';
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
  | 'operationLogs'
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
  /** Store-relative page (`dashboardStoreHref(slug, page)` builds the href). */
  page: DashboardPagePath;
  key: DashboardNavItemKey;
  icon: string;
  exact?: boolean;
  /** Store-relative page prefix that also marks this item active. */
  matchPage?: DashboardPagePath;
  /** Show checkout request badge on this nav item. */
  checkoutBadge?: boolean;
  featureId: string;
};

export type DashboardFeature = {
  id: string;
  /** Store-relative page. */
  page: DashboardPagePath;
  pageLoader: string;
  writePattern: DashboardWritePattern;
  aliases?: string[];
  riskNote?: string;
};

export const DASHBOARD_NAV_ITEMS: Record<string, DashboardNavItemDef> = {
  overview: {
    id: 'overview',
    page: '',
    key: 'overview',
    icon: '📊',
    exact: true,
    featureId: 'overview',
  },
  valueAnalytics: {
    id: 'valueAnalytics',
    page: '/value-analytics',
    key: 'valueAnalytics',
    icon: '📈',
    featureId: 'value-analytics',
  },
  abnormalOps: {
    id: 'abnormalOps',
    page: '/abnormal-operations',
    key: 'abnormalOps',
    icon: '⚠️',
    featureId: 'abnormal-operations',
  },
  operationLogs: {
    id: 'operationLogs',
    page: '/operation-logs',
    key: 'operationLogs',
    icon: '📝',
    featureId: 'operation-logs',
  },
  settings: {
    id: 'settings',
    page: '/settings',
    key: 'settings',
    icon: '⚙️',
    matchPage: '/settings',
    featureId: 'settings-profile',
  },
  checkout: {
    id: 'checkout',
    page: '/checkout',
    key: 'checkout',
    icon: '💳',
    checkoutBadge: true,
    featureId: 'checkout',
  },
  orders: {
    id: 'orders',
    page: '/orders',
    key: 'orders',
    icon: '📋',
    featureId: 'orders',
  },
  dishHistory: {
    id: 'dishHistory',
    page: '/dish-history',
    key: 'dishHistory',
    icon: '🔎',
    featureId: 'dish-history',
  },
  tables: {
    id: 'tables',
    page: '/tables',
    key: 'tables',
    icon: '🪑',
    featureId: 'tables',
  },
  menu: {
    id: 'menu',
    page: '/menu',
    key: 'menu',
    icon: '📋',
    featureId: 'menu',
  },
  guestNotice: {
    id: 'guestNotice',
    page: '/guest-notice',
    key: 'guestNotice',
    icon: '📢',
    featureId: 'guest-notice',
  },
  waiterBoard: {
    id: 'waiterBoard',
    page: '/waiter',
    key: 'viewWaiter',
    icon: '🛎️',
    matchPage: '/waiter',
    featureId: 'waiter-board',
  },
};

/**
 * Canonical dashboard feature access map (paths / loaders).
 * Top-nav **order** is sole `DASHBOARD_TOP_NAV_ORDER` in `dashboard-top-nav.ts`
 * (not `Object.values` of this map). Live UI nav + middleware: capabilities only
 * (`buildDashboardTopNavItems` / `middlewareAllowsPathForCapabilities`).
 * Backend admin is `resolveCapabilitiesForOwner() → '*'`.
 */
export const DASHBOARD_FEATURES: DashboardFeature[] = [
  {
    id: 'overview',
    page: '',
    pageLoader: 'getDashboardOperationalContext (dashboard.overview.view)',
    writePattern: 'read-only',
  },
  {
    id: 'value-analytics',
    page: '/value-analytics',
    pageLoader: 'getOwnerAnalyticsContext (dashboard.value_analytics.view)',
    writePattern: 'read-only',
    aliases: [
      '/api/restaurants/[slug]/analytics/value-overview',
      '/api/restaurants/[slug]/analytics/menu-item-consumption',
    ],
  },
  {
    id: 'abnormal-operations',
    page: '/abnormal-operations',
    pageLoader: 'loadOwnerAbnormalOperationsContext (dashboard.abnormal_ops.view)',
    writePattern: 'server-api',
    aliases: ['/api/restaurants/[slug]/abnormal-operations'],
  },
  {
    id: 'operation-logs',
    page: '/operation-logs',
    pageLoader: 'loadOperationLogsAccessContext (dashboard.operation_logs.view)',
    writePattern: 'read-only',
    aliases: ['/api/restaurants/[slug]/operation-logs'],
  },
  {
    id: 'settings-profile',
    page: '/settings',
    pageLoader:
      'settings hub: dashboard.settings.view; profile body: settings.profile.manage; else firstAccessibleSettingsChildPage',
    writePattern: 'server-api',
    aliases: ['/api/restaurants/[slug]/settings', '/api/restaurants/[slug]/storefront-image'],
  },
  {
    id: 'settings-staff',
    page: '/settings/staff',
    pageLoader: 'requireRestaurantForSettingsPermission (settings.staff.manage)',
    writePattern: 'server-api',
    aliases: ['/api/restaurants/[slug]/staff-accounts'],
  },
  {
    id: 'settings-features',
    page: '/settings/features',
    pageLoader: 'requireRestaurantForSettingsPermission (settings.features.manage)',
    writePattern: 'server-api',
    aliases: ['/api/restaurants/[slug]/features'],
  },
  {
    id: 'settings-buffet',
    page: '/settings/buffet',
    pageLoader: 'requireRestaurantForSettingsPermission (settings.buffet.manage)',
    writePattern: 'server-api',
    aliases: ['/api/restaurants/[slug]/buffet'],
  },
  {
    id: 'settings-print-assistant',
    page: '/settings/print-assistant',
    pageLoader: 'requireSettingsRestaurantAuth (settings.print_assistant.manage)',
    writePattern: 'server-api',
    aliases: ['/api/print-agent/pairings', '/api/print-agent/settings', '/api/print-agent/devices'],
  },
  {
    id: 'checkout',
    page: '/checkout',
    pageLoader: 'loadDashboardAccess',
    writePattern: 'server-api-partial',
    aliases: [
      '/api/restaurants/[slug]/checkout/apply-discount',
      '/api/restaurants/[slug]/checkout/confirm-payment',
      '/api/restaurants/[slug]/close-table-session',
    ],
    riskNote:
      'Page read uses client bill_splits RLS; confirm-payment is capability-gated. Force-close API: tables.force_close only (RPC: owner_id or any active staff).',
  },
  {
    id: 'orders',
    page: '/orders',
    pageLoader: 'loadOrderHistoryDashboardContext (dashboard.orders.view)',
    writePattern: 'read-only',
  },
  {
    id: 'dish-history',
    page: '/dish-history',
    pageLoader: 'DishHistoryPage (dashboard.dish_history.view)',
    writePattern: 'server-api',
    aliases: [
      '/api/restaurants/[slug]/staff/dish-history',
      '/api/restaurants/[slug]/staff/dish-history/remake',
    ],
  },
  {
    id: 'tables',
    page: '/tables',
    pageLoader: 'loadDashboardTables (dashboard.tables.view)',
    writePattern: 'server-api',
    aliases: ['/api/restaurants/[slug]/tables', '/api/restaurants/[slug]/table-groups', '/settings/tables'],
  },
  {
    id: 'menu',
    page: '/menu',
    pageLoader: 'loadDashboardMenu (dashboard.menu.view)',
    writePattern: 'server-api',
    aliases: [
      '/api/restaurants/[slug]/menu/categories',
      '/api/restaurants/[slug]/menu/items',
      '/api/restaurants/[slug]/menu/print-stations',
      '/api/restaurants/[slug]/menu/recommended',
      '/settings/print-stations',
    ],
    riskNote:
      'Page gated by dashboard.menu.view; 出品档口 Tab/CRUD by dashboard.menu.print_stations.manage (requires menu.view). Nav/middleware via capabilities only (owner `*`).',
  },
  {
    id: 'guest-notice',
    page: '/guest-notice',
    pageLoader: 'resolveDashboardCapabilityAccess (dashboard.guest_notice.view)',
    writePattern: 'server-api',
    aliases: ['/api/restaurants/[slug]/guest-notice'],
  },
  {
    id: 'waiter-board',
    page: '/waiter',
    pageLoader: 'requireWaiterBoardDashboardAccess (resolveWaiterBoardDashboardAccess)',
    writePattern: 'read-only',
    riskNote: 'Floor board via requireWaiterBoardDashboardAccess; force close uses resolveCloseTableSessionDeskActor + tables.force_close; 呼叫结账 goes through checkout ensure-entry (tables.checkout_close gates the button).',
  },
];

/** Store dashboard page gate — capability is the only gate. */
export function middlewareAllowsPathForCapabilities(
  capabilities: Capabilities,
  page: DashboardPagePath,
): boolean {
  if (dashboardPageMatches(page, '/upgrade')) return true;
  const permission = dashboardRoutePermission(page);
  if (!permission) return false;
  return can(capabilities, permission);
}

/** Redirect when capabilities do not cover the store page (owner `*` and staff share this). */
export function dashboardCapabilityMiddlewareRedirectPath(
  capabilities: Capabilities,
  page: DashboardPagePath,
  slug: string,
): string | null {
  if (middlewareAllowsPathForCapabilities(capabilities, page)) return null;
  return staffLandingPathFromCapabilities(slug, capabilities);
}
