import type { Order } from '@/types';
import { aggregateBuffetForOrders } from '@/lib/buffet-order';
import { normalizeOrderItemStatus } from '@/lib/order-status';
import { isBuffetBaseItem } from '@/lib/order-items';
import { resolveMenuItemCode } from '@/lib/menu-item-code';

export type WaiterOrderLine = {
  orderId: string;
  itemIdx: number;
  label: string;
  itemCode: string | null;
  canVoid: boolean;
};

export interface WaiterTableCardData {
  tableId: string;
  displayName: string;
  orderLines: WaiterOrderLine[];
  hasBuffet: boolean;
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
    updatedAt: '',
  };

  const buffetSummary = aggregateBuffetForOrders(orders);
  current.hasBuffet = buffetSummary != null;

  for (const order of orders) {
    const ts = order.updated_at || order.created_at;
    if (ts && (!current.updatedAt || ts > current.updatedAt)) {
      current.updatedAt = ts;
    }

    order.items.forEach((item, itemIdx) => {
      if (isBuffetBaseItem(item)) return;
      const status = normalizeOrderItemStatus(item, order.status);
      if (status === 'voided') return;

      const label = `${item.emoji} ${item.name || item.name_pt} × ${item.qty}`;
      current.orderLines.push({
        orderId: order.id,
        itemIdx,
        label,
        itemCode: resolveMenuItemCode(item, itemCodeByMenuId),
        canVoid: status === 'pending' || status === 'cooking',
      });
    });
  }

  return current;
}
