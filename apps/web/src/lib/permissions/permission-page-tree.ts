/**
 * Sole role-permission editor IA: product page tree (nav / settings tabs / page actions).
 * Do not render PERMISSION_GROUPS as a parallel checklist.
 */
import {
  DASHBOARD_NAV_ITEMS,
  type DashboardNavItemKey,
} from '@/lib/dashboard-feature-registry';
import type { UILanguage } from '@/lib/i18n';
import { getMessages } from '@/lib/i18n/messages';
import { rolePermissionsMessages } from '@/lib/i18n/role-permissions-messages';
import {
  ALL_PERMISSION_KEYS,
  NAV_PERMISSION,
  PERMISSIONS,
  type PermissionKey,
} from '@/lib/permissions/registry';
import { SETTINGS_NAV_TABS, type SettingsHubLabelKey } from '@/lib/settings-nav';

/** Where the checkbox label comes from — page nodes use product chrome copy only. */
export type PermissionTreeLabel =
  | { source: 'nav'; key: DashboardNavItemKey }
  | { source: 'navExtra'; key: 'viewKitchen' }
  | { source: 'settingsTab'; labelKey: SettingsHubLabelKey }
  /** Menu manager chrome tabs — copy from messages.menuManager. */
  | { source: 'menuTab'; key: 'tabStations' }
  | { source: 'action'; labelKey: string };

export type PermissionTreeNode = {
  permission: PermissionKey;
  label: PermissionTreeLabel;
  children?: readonly PermissionTreeNode[];
};

function settingsTabNodes(): PermissionTreeNode[] {
  const nodes: PermissionTreeNode[] = [];
  for (const item of SETTINGS_NAV_TABS) {
    if (!item.permission || item.backendAdminOnPremOnly) continue;
    if (item.permission === 'settings.print_assistant.manage') {
      nodes.push({
        permission: item.permission,
        label: { source: 'settingsTab', labelKey: item.labelKey },
        children: [
          {
            permission: 'print_agent.manage',
            label: { source: 'action', labelKey: 'printAgentManage' },
          },
          {
            permission: 'print_agent.receipt_printers.read',
            label: { source: 'action', labelKey: 'printAgentReceiptPrinters' },
          },
        ],
      });
      continue;
    }
    nodes.push({
      permission: item.permission,
      label: { source: 'settingsTab', labelKey: item.labelKey },
    });
  }
  return nodes;
}

function navPage(
  navId: keyof typeof NAV_PERMISSION,
  children?: readonly PermissionTreeNode[],
): PermissionTreeNode {
  const item = DASHBOARD_NAV_ITEMS[navId];
  return {
    permission: NAV_PERMISSION[navId],
    label: { source: 'nav', key: item.key },
    children,
  };
}

/**
 * Product page tree for role permission checkboxes (one representation).
 * Order follows staff-facing surfaces: ops → settings → checkout → history → floor → kitchen.
 */
export const ROLE_PERMISSION_PAGE_TREE: readonly PermissionTreeNode[] = [
  navPage('overview'),
  navPage('valueAnalytics'),
  navPage('abnormalOps'),
  navPage('operationLogs'),
  navPage('settings', settingsTabNodes()),
  navPage('checkout', [
    {
      permission: 'checkout.confirm_payment',
      label: { source: 'action', labelKey: 'checkoutConfirmPayment' },
    },
    {
      permission: 'checkout.apply_discount',
      label: { source: 'action', labelKey: 'checkoutApplyDiscount' },
    },
    {
      permission: 'checkout.request_whole_table',
      label: { source: 'action', labelKey: 'checkoutRequestWholeTable' },
    },
    {
      permission: 'checkout.assist_bill',
      label: { source: 'action', labelKey: 'checkoutAssistBill' },
    },
    {
      permission: 'checkout.print_pre_bill',
      label: { source: 'action', labelKey: 'checkoutPrintPreBill' },
    },
    {
      permission: 'checkout.open_pending_tables',
      label: { source: 'action', labelKey: 'checkoutOpenPendingTables' },
    },
  ]),
  navPage('orders'),
  navPage('dishHistory'),
  navPage('tables', [
    {
      permission: 'tables.manage',
      label: { source: 'action', labelKey: 'tablesManage' },
    },
  ]),
  navPage('menu', [
    {
      permission: 'dashboard.menu.print_stations.manage',
      label: { source: 'menuTab', key: 'tabStations' },
    },
  ]),
  navPage('guestNotice'),
  navPage('waiterBoard', [
    {
      permission: 'tables.open_session',
      label: { source: 'action', labelKey: 'tablesOpenSession' },
    },
    {
      permission: 'tables.transfer',
      label: { source: 'action', labelKey: 'tablesTransfer' },
    },
    {
      permission: 'tables.merge',
      label: { source: 'action', labelKey: 'tablesMerge' },
    },
    {
      permission: 'tables.checkout_close',
      label: { source: 'action', labelKey: 'tablesCheckoutClose' },
    },
    {
      permission: 'tables.force_close',
      label: { source: 'action', labelKey: 'tablesForceClose' },
    },
    {
      permission: 'orders.append',
      label: { source: 'action', labelKey: 'ordersAppend' },
    },
    {
      permission: 'orders.edit',
      label: { source: 'action', labelKey: 'ordersEdit' },
    },
    {
      permission: 'orders.menu_decrement',
      label: { source: 'action', labelKey: 'ordersMenuDecrement' },
    },
    {
      permission: 'orders.serve_to_table',
      label: { source: 'action', labelKey: 'ordersServeToTable' },
    },
    {
      permission: 'orders.print_receipt',
      label: { source: 'action', labelKey: 'ordersPrintReceipt' },
    },
  ]),
  {
    permission: 'floor.kitchen_board.view',
    label: { source: 'navExtra', key: 'viewKitchen' },
    children: [
      {
        permission: 'orders.kitchen_update',
        label: { source: 'action', labelKey: 'ordersKitchenUpdate' },
      },
    ],
  },
];

/** Flatten tree permissions in DFS order. */
export function flattenPermissionTreeKeys(
  nodes: readonly PermissionTreeNode[] = ROLE_PERMISSION_PAGE_TREE,
): PermissionKey[] {
  const out: PermissionKey[] = [];
  const walk = (list: readonly PermissionTreeNode[]) => {
    for (const node of list) {
      out.push(node.permission);
      if (node.children?.length) walk(node.children);
    }
  };
  walk(nodes);
  return out;
}

/** Every registry key appears exactly once in the page tree. */
export function assertPermissionPageTreeCoversRegistry(): void {
  const flat = flattenPermissionTreeKeys();
  const seen = new Set<PermissionKey>();
  for (const key of flat) {
    if (seen.has(key)) {
      throw new Error(`ROLE_PERMISSION_PAGE_TREE duplicate key: ${key}`);
    }
    seen.add(key);
  }
  for (const key of ALL_PERMISSION_KEYS) {
    if (!seen.has(key)) {
      throw new Error(`ROLE_PERMISSION_PAGE_TREE missing key: ${key}`);
    }
  }
  if (flat.length !== ALL_PERMISSION_KEYS.length) {
    throw new Error(
      `ROLE_PERMISSION_PAGE_TREE size ${flat.length} != registry ${ALL_PERMISSION_KEYS.length}`,
    );
  }
}

export function resolvePermissionTreeLabel(
  label: PermissionTreeLabel,
  lang: UILanguage,
): string {
  const messages = getMessages(lang);
  if (label.source === 'nav') {
    const v = messages.nav[label.key];
    return typeof v === 'string' ? v : label.key;
  }
  if (label.source === 'navExtra') {
    return messages.nav.viewKitchen;
  }
  if (label.source === 'settingsTab') {
    const v = messages.settingsHub[label.labelKey];
    return typeof v === 'string' ? v : label.labelKey;
  }
  if (label.source === 'menuTab') {
    const v = messages.menuManager[label.key];
    return typeof v === 'string' ? v : label.key;
  }
  const t = rolePermissionsMessages(lang);
  return t.perm[label.labelKey as keyof typeof t.perm] || label.labelKey;
}

export function permissionTreeNodeDangerous(permission: PermissionKey): boolean {
  return Boolean((PERMISSIONS[permission] as { dangerous?: boolean }).dangerous);
}
