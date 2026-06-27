import type { Order } from '@/types';
import { sumLineTotals } from '@/lib/cart-totals';
import { aggregateBuffetForOrders } from '@/lib/buffet-order';
import { guestCountFromTableOrders } from '@/lib/table-guest-count';
import { formatOrderItemListLabel } from '@/lib/order-list-display';
import { normalizeOrderItemStatus } from '@/lib/order-status';
import { isBuffetBaseItem } from '@/lib/order-items';
import { resolveMenuItemCode } from '@/lib/menu-item-code';

export type WaiterOrderLine = {
  orderId: string;
  itemIdx: number;
  label: string;
  itemCode: string | null;
  canDecrement: boolean;
};

export interface WaiterTableCardData {
  tableId: string;
  displayName: string;
  orderLines: WaiterOrderLine[];
  hasBuffet: boolean;
  guestCount: number;
  sessionTotal: number;
  updatedAt: string;
}

/** `orders` is already the table/session view (see ordersForWaiterTableView). */
export function buildWaiterTableCard(
  tableId: string,
  displayName: string,
  orders: Order[],
  itemCodeByMenuId: Record<string, string> = {},
): WaiterTableCardData {
  const current: WaiterTableCardData = {
    tableId,
    displayName,
    orderLines: [],
    hasBuffet: false,
    guestCount: 0,
    sessionTotal: 0,
    updatedAt: '',
  };

  const buffetSummary = aggregateBuffetForOrders(orders);
  current.hasBuffet = buffetSummary != null;
  current.guestCount = guestCountFromTableOrders(orders);

  const buffetLines: WaiterOrderLine[] = [];
  const menuLines: WaiterOrderLine[] = [];

  if (buffetSummary) {
    buffetLines.push({
      orderId: '',
      itemIdx: -1,
      label: formatOrderItemListLabel(
        {
          emoji: '🍽️',
          name: buffetSummary.name,
          name_pt: buffetSummary.name,
          kind: 'buffet_base',
          qty: 1,
          adult_count: buffetSummary.adults,
          child_count: buffetSummary.children,
        },
        { headcountStyle: 'compact' },
      ),
      itemCode: null,
      canDecrement: false,
    });
  }

  for (const order of orders) {
    const ts = order.updated_at || order.created_at;
    if (ts && (!current.updatedAt || ts > current.updatedAt)) {
      current.updatedAt = ts;
    }

    order.items.forEach((item, itemIdx) => {
      const status = normalizeOrderItemStatus(item, order.status);
      if (status === 'voided') return;

      if (isBuffetBaseItem(item)) {
        if (buffetSummary) return;
        buffetLines.push({
          orderId: order.id,
          itemIdx,
          label: formatOrderItemListLabel(item, { headcountStyle: 'compact' }),
          itemCode: null,
          canDecrement: false,
        });
        return;
      }

      menuLines.push({
        orderId: order.id,
        itemIdx,
        label: formatOrderItemListLabel(item),
        itemCode: resolveMenuItemCode(item, itemCodeByMenuId),
        canDecrement: status === 'pending' || status === 'cooking',
      });
    });
  }

  current.orderLines = [...buffetLines, ...menuLines];
  current.sessionTotal = sumActiveOrderItemsTotal(orders);
  return current;
}

/** Sum non-voided line totals across session orders for the waiter board. */
export function sumActiveOrderItemsTotal(orders: Order[]): number {
  let total = 0;
  for (const order of orders) {
    const activeItems = order.items.filter((item) => {
      const status = normalizeOrderItemStatus(item, order.status);
      return status !== 'voided';
    });
    total += sumLineTotals(activeItems);
  }
  return total;
}
