import type { Order } from '@/types';
import { aggregateBuffetForOrders } from '@/lib/buffet-order';
import { normalizeOrderItemStatus } from '@/lib/order-status';
import { isBuffetBaseItem } from '@/lib/order-items';

type WaiterVoidableItem = {
  orderId: string;
  itemIdx: number;
  label: string;
};

type SortableWaiterVoidableItem = WaiterVoidableItem & { sortAt: string };

export interface WaiterTableCardData {
  tableId: string;
  displayName: string;
  orderLines: string[];
  hasBuffet: boolean;
  voidableItems: WaiterVoidableItem[];
  updatedAt: string;
}

/** `orders` is already the table/session view (see ordersForWaiterTableView). */
export function buildWaiterTableCard(
  tableId: string,
  displayName: string,
  orders: Order[],
): WaiterTableCardData {
  const current: Omit<WaiterTableCardData, 'voidableItems'> & {
    voidableItems: SortableWaiterVoidableItem[];
  } = {
    tableId,
    displayName,
    orderLines: [],
    hasBuffet: false,
    voidableItems: [],
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

      current.orderLines.push(`${item.emoji} ${item.name || item.name_pt} × ${item.qty}`);

      if (status === 'pending' || status === 'cooking') {
        const sortAt = item.added_at || order.updated_at || order.created_at || '';
        current.voidableItems.push({
          orderId: order.id,
          itemIdx,
          label: `${item.emoji} ${item.name || item.name_pt} × ${item.qty}`,
          sortAt,
        });
      }
    });
  }

  current.voidableItems.sort((a, b) => {
    if (!a.sortAt && !b.sortAt) return 0;
    if (!a.sortAt) return 1;
    if (!b.sortAt) return -1;
    return b.sortAt.localeCompare(a.sortAt);
  });

  return {
    ...current,
    voidableItems: current.voidableItems.map(({ sortAt, ...item }) => {
      void sortAt;
      return item;
    }),
  };
}
