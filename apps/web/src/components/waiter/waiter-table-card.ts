import type { Order, OrderItem } from '@/types';
import {
  billableMenuItemMergeKey,
  buildBillableSessionItems,
  chargeableFieldsFromBillableRow,
  menuItemIdFromLimitedBillableKey,
  sortOrdersForBillableCatalog,
  sumBillableNonBuffetTotal,
  sumBillableSessionTotal,
} from '@/lib/billable-session-lines';
import {
  aggregateBuffetHeadcountForOrders,
  listActiveBuffetLineSummaries,
  type BuffetGuestHeadcount,
} from '@/lib/buffet-order';
import {
  formatStaffBuffetLineLabel,
  formatOrderItemPlainName,
  formatOrderItemQuantityLabel,
} from '@/lib/order-list-display';
import { canDecrementOrderLine } from '@/lib/order-item-decrement/decrement-policy';
import { can, type Capabilities } from '@/lib/permissions/can';
import { normalizeOrderItemStatus, effectiveItemStatus } from '@/lib/order-status';
import { isBuffetBaseItem } from '@/lib/order-items';
import { resolveMenuItemCode } from '@/lib/menu-item-code';
import { KITCHEN_READY_AFTER_MINUTES_DEFAULT } from '@/lib/print-agent-config';
import type { UILanguage } from '@/lib/i18n';
import {
  resolveKitchenItemProgressLabel,
  shouldShowKitchenItemProgress,
} from '@/lib/kitchen-progress-display';

export type WaiterOrderLine = {
  /** Stable billable catalog key (`buffet:*`, `limited:*`, or `menuId::price`). */
  catalogKey: string;
  orderId: string;
  itemIdx: number;
  /** Menu item code prefix (`018`); null for buffet / missing code. */
  itemCode: string | null;
  /** Dish/buffet name (no item code — code is `itemCode`). */
  label: string;
  /** Kitchen-enabled station progress (effective status); null for non-kitchen lines. */
  statusLabel: string | null;
  /** Menu lines: `× N` shown beside the decrement control. */
  quantityLabel: string | null;
  canDecrement: boolean;
  /** Feature + capability + kitchen station gate + effective ready. */
  canServe: boolean;
  serveOrderId: string | null;
  serveItemIdx: number | null;
  /** Sushi limited dish: chargeable share of this row (null when fully included). */
  chargeableQty: number | null;
  chargeableUnitPrice: number | null;
};

export interface WaiterTableCardData {
  tableId: string;
  displayName: string;
  orderLines: WaiterOrderLine[];
  hasBuffet: boolean;
  buffetHeadcount: BuffetGuestHeadcount | null;
  sessionTotal: number;
  /** Non-buffet billable total for ordered-items money chrome (饮食). */
  mealsTotal: number;
  updatedAt: string;
}

type MenuLineActionTarget = Pick<
  WaiterOrderLine,
  'orderId' | 'itemIdx' | 'canDecrement' | 'canServe' | 'serveOrderId' | 'serveItemIdx'
>;

type MenuLineCandidate = {
  orderId: string;
  itemIdx: number;
  item: OrderItem;
  order: Order;
};

/**
 * Pick the physical order line for decrement on a billable merge group.
 * Prefers a decrementable row with qty > 1 (avoids void-reason dialog), then any
 * decrementable row, then the first matching active row (display-only pointer).
 */
function resolveMenuLineActionTarget(
  orders: Order[],
  mergeKey: string,
  capabilities: Capabilities,
  serveEnabled: boolean,
  readyAfterMinutes: number,
  nowMs: number,
  kitchenEnabledStationIds: readonly string[],
): MenuLineActionTarget {
  const match = (item: OrderItem) => {
    const limitedMenuItemId = menuItemIdFromLimitedBillableKey(mergeKey);
    if (limitedMenuItemId) {
      return item.id === limitedMenuItemId;
    }
    return billableMenuItemMergeKey(item) === mergeKey;
  };

  const base = pickMenuLineActionTarget(orders, capabilities, match);
  let canServe = false;
  let serveOrderId: string | null = null;
  let serveItemIdx: number | null = null;

  if (serveEnabled && can(capabilities, 'orders.serve_to_table')) {
    for (const order of orders) {
      const items = order.items || [];
      for (let itemIdx = 0; itemIdx < items.length; itemIdx += 1) {
        const item = items[itemIdx];
        if (!item || isBuffetBaseItem(item)) continue;
        if (!match(item)) continue;
        if (
          !shouldShowKitchenItemProgress({
            printStationId: item.print_station_id,
            kitchenEnabledStationIds,
            item,
          })
        ) {
          continue;
        }
        const effective = effectiveItemStatus({
          item,
          orderStatus: order.status,
          nowMs,
          readyAfterMinutes,
        });
        if (effective === 'ready') {
          canServe = true;
          serveOrderId = order.id;
          serveItemIdx = itemIdx;
          break;
        }
      }
      if (canServe) break;
    }
  }

  return {
    orderId: base.orderId,
    itemIdx: base.itemIdx,
    canDecrement: base.canDecrement,
    canServe,
    serveOrderId,
    serveItemIdx,
  };
}

function pickMenuLineActionTarget(
  orders: Order[],
  capabilities: Capabilities,
  match: (item: OrderItem) => boolean,
): Pick<WaiterOrderLine, 'orderId' | 'itemIdx' | 'canDecrement'> {
  let fallback: MenuLineCandidate | null = null;
  let bestDecrementable: MenuLineCandidate | null = null;
  let bestQtyGt1: MenuLineCandidate | null = null;

  for (const order of orders) {
    const items = order.items || [];
    for (let itemIdx = 0; itemIdx < items.length; itemIdx += 1) {
      const item = items[itemIdx];
      if (!item || isBuffetBaseItem(item)) continue;
      if (normalizeOrderItemStatus(item, order.status) === 'voided') continue;
      if (!match(item)) continue;

      const loc: MenuLineCandidate = { orderId: order.id, itemIdx, item, order };
      if (!fallback) fallback = loc;

      if (!canDecrementOrderLine(capabilities, item, order.status)) continue;
      if (!bestDecrementable) bestDecrementable = loc;
      if (item.qty > 1 && !bestQtyGt1) bestQtyGt1 = loc;
    }
  }

  const chosen = bestQtyGt1 ?? bestDecrementable ?? fallback;
  if (!chosen) {
    return { orderId: '', itemIdx: -1, canDecrement: false };
  }

  return {
    orderId: chosen.orderId,
    itemIdx: chosen.itemIdx,
    canDecrement: canDecrementOrderLine(capabilities, chosen.item, chosen.order.status),
  };
}

function latestOrderTimestamp(orders: Order[]): string {
  let latest = '';
  for (const order of orders) {
    const ts = order.updated_at || order.created_at;
    if (ts && (!latest || ts > latest)) latest = ts;
  }
  return latest;
}

/** `orders` is already the table/session view (see ordersForWaiterTableView). */
export function buildWaiterTableCard(
  tableId: string,
  displayName: string,
  orders: Order[],
  itemCodeByMenuId: Record<string, string> = {},
  /** Board list summaries may omit this; decrement flags then stay false. */
  capabilities: Capabilities = new Set(),
  options: {
    serveEnabled?: boolean;
    readyAfterMinutes?: number;
    nowMs?: number;
    lang?: UILanguage;
    kitchenEnabledStationIds?: readonly string[];
  } = {},
): WaiterTableCardData {
  const buffetSummaries = listActiveBuffetLineSummaries(orders);
  const catalogOrders = sortOrdersForBillableCatalog(orders);
  const catalog = buildBillableSessionItems(catalogOrders);
  const serveEnabled = options.serveEnabled === true;
  const readyAfterMinutes =
    options.readyAfterMinutes ?? KITCHEN_READY_AFTER_MINUTES_DEFAULT;
  const nowMs = options.nowMs ?? Date.now();
  const lang = options.lang ?? 'zh';
  const kitchenEnabledStationIds = options.kitchenEnabledStationIds ?? [];

  const orderLines: WaiterOrderLine[] = catalog.map((row) => {
    const { key, item } = row;
    if (isBuffetBaseItem(item)) {
      return {
        catalogKey: row.key,
        orderId: '',
        itemIdx: -1,
        itemCode: null,
        label: formatStaffBuffetLineLabel(item, { headcountStyle: 'receipt' }),
        statusLabel: null,
        quantityLabel: null,
        canDecrement: false,
        canServe: false,
        serveOrderId: null,
        serveItemIdx: null,
        chargeableQty: null,
        chargeableUnitPrice: null,
      };
    }

    const action = resolveMenuLineActionTarget(
      catalogOrders,
      key,
      capabilities,
      serveEnabled,
      readyAfterMinutes,
      nowMs,
      kitchenEnabledStationIds,
    );
    const share = chargeableFieldsFromBillableRow(row);
    const statusOrder =
      action.orderId !== '' ? orders.find((order) => order.id === action.orderId) : undefined;
    const statusItem =
      statusOrder && action.itemIdx >= 0
        ? statusOrder.items?.[action.itemIdx] ?? item
        : item;
    const statusLabel = resolveKitchenItemProgressLabel({
      lang,
      item: statusItem,
      orderStatus: statusOrder?.status ?? 'pending',
      nowMs,
      readyAfterMinutes,
      printStationId: statusItem.print_station_id,
      kitchenEnabledStationIds,
    });

    return {
      catalogKey: row.key,
      ...action,
      itemCode: resolveMenuItemCode(item, itemCodeByMenuId),
      label: formatOrderItemPlainName(item),
      statusLabel,
      quantityLabel: formatOrderItemQuantityLabel(item, { headcountStyle: 'receipt' }),
      chargeableQty: share.chargeableQty ?? null,
      chargeableUnitPrice: share.chargeableUnitPrice ?? null,
    };
  });

  return {
    tableId,
    displayName,
    orderLines,
    hasBuffet: buffetSummaries.length > 0,
    buffetHeadcount: aggregateBuffetHeadcountForOrders(orders),
    sessionTotal: sumBillableSessionTotal(orders),
    mealsTotal: sumBillableNonBuffetTotal(orders),
    updatedAt: latestOrderTimestamp(orders),
  };
}
