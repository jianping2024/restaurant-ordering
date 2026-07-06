import type { Order } from '@/types';
import {
  aggregateBuffetHeadcountForOrders,
  listActiveBuffetLineSummaries,
  type BuffetGuestHeadcount,
} from '@/lib/buffet-order';
import { formatOrderItemListLabel, formatOrderItemNameLabel, formatOrderItemQuantityLabel } from '@/lib/order-list-display';
import { normalizeOrderItemStatus } from '@/lib/order-status';
import { isBuffetBaseItem } from '@/lib/order-items';
import { resolveMenuItemCode } from '@/lib/menu-item-code';

export type WaiterOrderLine = {
  orderId: string;
  itemIdx: number;
  label: string;
  /** Menu lines: `× N` shown beside the decrement control. */
  quantityLabel: string | null;
  itemCode: string | null;
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
    buffetHeadcount: null,
    sessionTotal: 0,
    updatedAt: '',
  };

  const buffetSummaries = listActiveBuffetLineSummaries(orders);
  current.hasBuffet = buffetSummaries.length > 0;
  current.buffetHeadcount = aggregateBuffetHeadcountForOrders(orders);

  const buffetLines: WaiterOrderLine[] = [];
  const menuLines: WaiterOrderLine[] = [];

  for (const summary of buffetSummaries) {
    buffetLines.push({
      orderId: '',
      itemIdx: -1,
      label: formatOrderItemListLabel(
        {
          emoji: '🍽️',
          name: summary.name,
          name_pt: summary.name,
          kind: 'buffet_base',
          qty: 1,
          adult_count: summary.adults,
          child_count: summary.children,
        },
        { headcountStyle: 'compact' },
      ),
      quantityLabel: null,
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
        if (buffetSummaries.length > 0) return;
        buffetLines.push({
          orderId: order.id,
          itemIdx,
          label: formatOrderItemListLabel(item, { headcountStyle: 'compact' }),
          quantityLabel: null,
          itemCode: null,
          canDecrement: false,
        });
        return;
      }

      menuLines.push({
        orderId: order.id,
        itemIdx,
        label: formatOrderItemNameLabel(item),
        quantityLabel: formatOrderItemQuantityLabel(item, { headcountStyle: 'compact' }),
        itemCode: resolveMenuItemCode(item, itemCodeByMenuId),
        canDecrement: true,
      });
    });
  }

  current.orderLines = [...buffetLines, ...menuLines];
  current.sessionTotal = orders.reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0);

  return current;
}
