import type { Order, OrderItem } from '@/types';
import {
  billableMenuItemMergeKey,
  buildBillableSessionItems,
} from '@/lib/billable-session-lines';
import { sumOrderTotals } from '@/lib/cart-totals';
import {
  aggregateBuffetHeadcountForOrders,
  listActiveBuffetLineSummaries,
  type BuffetGuestHeadcount,
} from '@/lib/buffet-order';
import {
  formatStaffBuffetLineLabel,
  formatStaffMenuLineLabel,
  formatOrderItemQuantityLabel,
} from '@/lib/order-list-display';
import {
  canDecrementOrderLine,
  type MenuDecrementOperator,
} from '@/lib/order-item-decrement/decrement-policy';
import { normalizeOrderItemStatus } from '@/lib/order-status';
import { isBuffetBaseItem } from '@/lib/order-items';
import { resolveMenuItemCode } from '@/lib/menu-item-code';

export type WaiterOrderLine = {
  orderId: string;
  itemIdx: number;
  label: string;
  /** Menu lines: `× N` shown beside the decrement control. */
  quantityLabel: string | null;
  canDecrement: boolean;
};

export interface WaiterTableCardData {
  tableId: string;
  displayName: string;
  orderLines: WaiterOrderLine[];
  hasBuffet: boolean;
  buffetHeadcount: BuffetGuestHeadcount | null;
  sessionTotal: number;
  updatedAt: string;
}

type MenuLineActionTarget = Pick<WaiterOrderLine, 'orderId' | 'itemIdx' | 'canDecrement'>;

/**
 * Pick the physical order line for decrement on a billable merge group.
 * Prefers a decrementable row with qty > 1 (avoids void-reason dialog), then any
 * decrementable row, then the first matching active row (display-only pointer).
 */
function resolveMenuLineActionTarget(
  orders: Order[],
  mergeKey: string,
  operator: MenuDecrementOperator,
): MenuLineActionTarget {
  let fallback: { orderId: string; itemIdx: number; item: OrderItem; order: Order } | null = null;
  let bestDecrementable: { orderId: string; itemIdx: number; item: OrderItem; order: Order } | null =
    null;
  let bestQtyGt1: { orderId: string; itemIdx: number; item: OrderItem; order: Order } | null = null;

  for (const order of orders) {
    (order.items || []).forEach((item, itemIdx) => {
      if (isBuffetBaseItem(item)) return;
      if (normalizeOrderItemStatus(item, order.status) === 'voided') return;
      if (billableMenuItemMergeKey(item) !== mergeKey) return;

      const loc = { orderId: order.id, itemIdx, item, order };
      if (!fallback) fallback = loc;

      if (!canDecrementOrderLine(operator, item, order.status)) return;
      if (!bestDecrementable) bestDecrementable = loc;
      if (item.qty > 1 && !bestQtyGt1) bestQtyGt1 = loc;
    });
  }

  const chosen = bestQtyGt1 ?? bestDecrementable ?? fallback;
  if (!chosen) {
    return { orderId: '', itemIdx: -1, canDecrement: false };
  }

  return {
    orderId: chosen.orderId,
    itemIdx: chosen.itemIdx,
    canDecrement: canDecrementOrderLine(operator, chosen.item, chosen.order.status),
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
  menuDecrementOperator: MenuDecrementOperator = 'waiter_staff',
): WaiterTableCardData {
  const buffetSummaries = listActiveBuffetLineSummaries(orders);
  const catalog = buildBillableSessionItems(orders);

  const orderLines: WaiterOrderLine[] = catalog.map(({ key, item }) => {
    if (isBuffetBaseItem(item)) {
      return {
        orderId: '',
        itemIdx: -1,
        label: formatStaffBuffetLineLabel(item, { headcountStyle: 'receipt' }),
        quantityLabel: null,
        canDecrement: false,
      };
    }

    const action = resolveMenuLineActionTarget(orders, key, menuDecrementOperator);
    return {
      ...action,
      label: formatStaffMenuLineLabel(item, resolveMenuItemCode(item, itemCodeByMenuId)),
      quantityLabel: formatOrderItemQuantityLabel(item, { headcountStyle: 'receipt' }),
    };
  });

  return {
    tableId,
    displayName,
    orderLines,
    hasBuffet: buffetSummaries.length > 0,
    buffetHeadcount: aggregateBuffetHeadcountForOrders(orders),
    sessionTotal: sumOrderTotals(orders),
    updatedAt: latestOrderTimestamp(orders),
  };
}
