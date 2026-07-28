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
  'buffet',
  'floor',
  'print',
] as const;

export type PermissionGroup = (typeof PERMISSION_GROUPS)[number];

export type PermissionDef = {
  group: PermissionGroup;
  /** i18n key under messages.rolePermissions.perm.* */
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
  'dashboard.settings.view': { group: 'dashboard_nav', labelKey: 'dashboardSettings' },
  'dashboard.checkout.view': { group: 'dashboard_nav', labelKey: 'dashboardCheckout' },
  'dashboard.orders.view': { group: 'dashboard_nav', labelKey: 'dashboardOrders' },
  'dashboard.tables.view': { group: 'dashboard_nav', labelKey: 'dashboardTables' },
  'dashboard.menu.view': { group: 'dashboard_nav', labelKey: 'dashboardMenu' },
  'dashboard.waiter_board.view': { group: 'dashboard_nav', labelKey: 'dashboardWaiterBoard' },
  'dashboard.kitchen_shortcut.view': { group: 'dashboard_nav', labelKey: 'dashboardKitchenShortcut' },

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

  // Tables / sessions
  'tables.manage': { group: 'tables', labelKey: 'tablesManage', dangerous: true },
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
  'orders.print_receipt': { group: 'orders', labelKey: 'ordersPrintReceipt' },

  // Buffet
  'buffet.post_to_table': { group: 'buffet', labelKey: 'buffetPostToTable' },

  // Floor boards
  'floor.kitchen_board.view': { group: 'floor', labelKey: 'floorKitchenBoard' },
  'floor.waiter_board.view': { group: 'floor', labelKey: 'floorWaiterBoard' },

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
  settings: 'dashboard.settings.view',
  checkout: 'dashboard.checkout.view',
  orders: 'dashboard.orders.view',
  tables: 'dashboard.tables.view',
  menu: 'dashboard.menu.view',
  waiterBoard: 'dashboard.waiter_board.view',
};

/** Dashboard pathname prefix → required permission (longest match wins at resolve time). */
export const DASHBOARD_ROUTE_PERMISSIONS: { prefix: string; permission: PermissionKey }[] = [
  { prefix: '/dashboard/settings', permission: 'dashboard.settings.view' },
  { prefix: '/dashboard/checkout', permission: 'dashboard.checkout.view' },
  { prefix: '/dashboard/orders', permission: 'dashboard.orders.view' },
  { prefix: '/dashboard/tables', permission: 'dashboard.tables.view' },
  { prefix: '/dashboard/menu', permission: 'dashboard.menu.view' },
  { prefix: '/dashboard/waiter', permission: 'dashboard.waiter_board.view' },
  { prefix: '/dashboard/value-analytics', permission: 'dashboard.value_analytics.view' },
  { prefix: '/dashboard/abnormal-operations', permission: 'dashboard.abnormal_ops.view' },
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
