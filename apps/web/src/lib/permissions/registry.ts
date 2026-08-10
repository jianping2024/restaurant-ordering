/**
 * Single catalog of staff permission keys.
 * Nav, routes, buttons, and API gates all reference these — never role enums.
 */

export const PERMISSION_GROUPS = [
  'dashboard_nav',
  'settings',
  'checkout',
  'tables',
  'orders',
  'floor',
  'print',
] as const;

export type PermissionGroup = (typeof PERMISSION_GROUPS)[number];

export type PermissionDef = {
  /** Catalog bucket only — role editor IA is ROLE_PERMISSION_PAGE_TREE, not these groups. */
  group: PermissionGroup;
  /**
   * Stable id for action-row copy in rolePermissionsMessages.perm.* when the page tree
   * uses source:'action'. Page/settings nodes resolve labels from nav/settingsHub instead.
   */
  labelKey: string;
  dangerous?: boolean;
  requires?: readonly string[];
};

/**
 * Permission keys. Add here first, then wire NAV/ROUTE/API/templates.
 */
export const PERMISSIONS = {
  // Dashboard nav (page entry)
  'dashboard.overview.view': { group: 'dashboard_nav', labelKey: 'dashboardOverview' },
  'dashboard.value_analytics.view': { group: 'dashboard_nav', labelKey: 'dashboardValueAnalytics' },
  'dashboard.abnormal_ops.view': { group: 'dashboard_nav', labelKey: 'dashboardAbnormalOps' },
  'dashboard.operation_logs.view': { group: 'dashboard_nav', labelKey: 'dashboardOperationLogs' },
  'dashboard.settings.view': { group: 'dashboard_nav', labelKey: 'dashboardSettings' },
  'dashboard.checkout.view': { group: 'dashboard_nav', labelKey: 'dashboardCheckout' },
  'dashboard.orders.view': { group: 'dashboard_nav', labelKey: 'dashboardOrders' },
  'dashboard.tables.view': { group: 'dashboard_nav', labelKey: 'dashboardTables' },
  'dashboard.menu.view': { group: 'dashboard_nav', labelKey: 'dashboardMenu' },
  'dashboard.waiter_board.view': { group: 'dashboard_nav', labelKey: 'dashboardWaiterBoard' },
  'dashboard.guest_notice.view': { group: 'dashboard_nav', labelKey: 'dashboardGuestNotice' },

  // Settings (formerly owner-only; grantable to any role per product)
  'settings.profile.manage': {
    group: 'settings',
    labelKey: 'settingsProfile',
    requires: ['dashboard.settings.view'],
  },
  'settings.staff.manage': {
    group: 'settings',
    labelKey: 'settingsStaff',
    dangerous: true,
    requires: ['dashboard.settings.view'],
  },
  'settings.roles.manage': {
    group: 'settings',
    labelKey: 'settingsRoles',
    dangerous: true,
    requires: ['dashboard.settings.view'],
  },
  'settings.features.manage': {
    group: 'settings',
    labelKey: 'settingsFeatures',
    requires: ['dashboard.settings.view'],
  },
  'settings.buffet.manage': {
    group: 'settings',
    labelKey: 'settingsBuffet',
    requires: ['dashboard.settings.view'],
  },
  'settings.print_assistant.manage': {
    group: 'settings',
    labelKey: 'settingsPrintAssistant',
    requires: ['dashboard.settings.view'],
  },

  // Checkout actions
  'checkout.confirm_payment': { group: 'checkout', labelKey: 'checkoutConfirmPayment', dangerous: true },
  'checkout.apply_discount': {
    group: 'checkout',
    labelKey: 'checkoutApplyDiscount',
    dangerous: true,
    requires: ['checkout.confirm_payment'],
  },
  'checkout.request_whole_table': { group: 'checkout', labelKey: 'checkoutRequestWholeTable' },
  'checkout.assist_bill': { group: 'checkout', labelKey: 'checkoutAssistBill' },
  'checkout.print_pre_bill': { group: 'checkout', labelKey: 'checkoutPrintPreBill' },
  'checkout.open_pending_tables': { group: 'checkout', labelKey: 'checkoutOpenPendingTables' },

  // Tables / sessions (楼面 · 桌台详情 actions)
  'tables.manage': { group: 'tables', labelKey: 'tablesManage', dangerous: true },
  /** Sole gate for 开台 / 保存人数 on table detail (POST …/waiter/buffet). */
  'tables.open_session': { group: 'tables', labelKey: 'tablesOpenSession' },
  'tables.checkout_close': { group: 'tables', labelKey: 'tablesCheckoutClose', dangerous: true },
  'tables.force_close': { group: 'tables', labelKey: 'tablesForceClose', dangerous: true },
  'tables.transfer': { group: 'tables', labelKey: 'tablesTransfer', dangerous: true },
  'tables.merge': { group: 'tables', labelKey: 'tablesMerge', dangerous: true },

  // Orders
  'orders.append': { group: 'orders', labelKey: 'ordersAppend' },
  'orders.edit': { group: 'orders', labelKey: 'ordersEdit' },
  'orders.menu_decrement': { group: 'orders', labelKey: 'ordersMenuDecrement', dangerous: true },
  'orders.kitchen_update': { group: 'orders', labelKey: 'ordersKitchenUpdate' },
  'orders.serve_to_table': { group: 'orders', labelKey: 'ordersServeToTable' },
  'orders.print_receipt': { group: 'orders', labelKey: 'ordersPrintReceipt' },

  // Floor boards
  'floor.kitchen_board.view': { group: 'floor', labelKey: 'floorKitchenBoard' },
  /** Lives under 餐厅设置 hub; group settings so role UI nests it once under settings entry. */
  'floor.kitchen_screens.manage': {
    group: 'settings',
    labelKey: 'floorKitchenScreensManage',
    requires: ['dashboard.settings.view'],
  },

  // Dish history (当日菜品)
  'dashboard.dish_history.view': { group: 'dashboard_nav', labelKey: 'dashboardDishHistory' },

  // Print agent dashboard
  'print_agent.manage': { group: 'print', labelKey: 'printAgentManage', dangerous: true },
  'print_agent.receipt_printers.read': { group: 'print', labelKey: 'printAgentReceiptPrinters' },
} as const satisfies Record<string, PermissionDef>;

export type PermissionKey = keyof typeof PERMISSIONS;

export const ALL_PERMISSION_KEYS = Object.keys(PERMISSIONS) as PermissionKey[];

export function isPermissionKey(value: string): value is PermissionKey {
  return Object.prototype.hasOwnProperty.call(PERMISSIONS, value);
}

/** Nav item → permission that gates visibility and middleware. */
export const NAV_PERMISSION: Record<string, PermissionKey> = {
  overview: 'dashboard.overview.view',
  valueAnalytics: 'dashboard.value_analytics.view',
  abnormalOps: 'dashboard.abnormal_ops.view',
  operationLogs: 'dashboard.operation_logs.view',
  settings: 'dashboard.settings.view',
  checkout: 'dashboard.checkout.view',
  orders: 'dashboard.orders.view',
  dishHistory: 'dashboard.dish_history.view',
  tables: 'dashboard.tables.view',
  menu: 'dashboard.menu.view',
  waiterBoard: 'dashboard.waiter_board.view',
  guestNotice: 'dashboard.guest_notice.view',
};

/** Dashboard pathname prefix → required permission (longest match wins at resolve time). */
export const DASHBOARD_ROUTE_PERMISSIONS: { prefix: string; permission: PermissionKey }[] = [
  { prefix: '/dashboard/settings', permission: 'dashboard.settings.view' },
  { prefix: '/dashboard/checkout', permission: 'dashboard.checkout.view' },
  { prefix: '/dashboard/orders', permission: 'dashboard.orders.view' },
  { prefix: '/dashboard/dish-history', permission: 'dashboard.dish_history.view' },
  { prefix: '/dashboard/tables', permission: 'dashboard.tables.view' },
  { prefix: '/dashboard/menu', permission: 'dashboard.menu.view' },
  { prefix: '/dashboard/waiter', permission: 'dashboard.waiter_board.view' },
  { prefix: '/dashboard/value-analytics', permission: 'dashboard.value_analytics.view' },
  { prefix: '/dashboard/abnormal-operations', permission: 'dashboard.abnormal_ops.view' },
  { prefix: '/dashboard/operation-logs', permission: 'dashboard.operation_logs.view' },
  { prefix: '/dashboard/guest-notice', permission: 'dashboard.guest_notice.view' },
  { prefix: '/dashboard', permission: 'dashboard.overview.view' },
];

export function dashboardRoutePermission(pathname: string): PermissionKey | null {
  const sorted = [...DASHBOARD_ROUTE_PERMISSIONS].sort((a, b) => b.prefix.length - a.prefix.length);
  for (const row of sorted) {
    if (pathname === row.prefix || pathname.startsWith(`${row.prefix}/`)) {
      return row.permission;
    }
  }
  return null;
}
