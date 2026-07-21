import { checkoutLinesFromOrders, type CheckoutDisplayLine } from '@/lib/checkout-session-lines';
import type { Order, OrderItem } from '@/types';

/** Items voided within this window of session close count as final bill lines. */
export const CLOSE_VOID_TOLERANCE_MS = 10_000;

export function isCloseSnapshotConsumptionItem(
  item: Pick<OrderItem, 'item_status' | 'voided_at'>,
  closedAt: string,
): boolean {
  if (item.item_status !== 'voided') return true;
  if (!item.voided_at) return false;

  const voidedMs = new Date(item.voided_at).getTime();
  const closedMs = new Date(closedAt).getTime();
  if (Number.isNaN(voidedMs) || Number.isNaN(closedMs)) return false;

  return voidedMs >= closedMs - CLOSE_VOID_TOLERANCE_MS;
}

function ordersForCloseSnapshot(orders: Order[], closedAt: string): Order[] {
  return orders
    .map((order) => ({
      ...order,
      items: (order.items || []).filter((item) =>
        isCloseSnapshotConsumptionItem(item, closedAt),
      ),
    }))
    .filter((order) => order.items.length > 0);
}

/** Strip void markers so billable aggregation renders clean menu lines (no strikethrough). */
function ordersAsBillableDisplay(orders: Order[]): Order[] {
  return orders.map((order) => ({
    ...order,
    items: order.items.map((item) =>
      item.item_status === 'voided'
        ? { ...item, item_status: 'done' as const }
        : item,
    ),
  }));
}

export function buildOrderHistorySessionLines(
  orders: Order[],
  closedAt: string,
  isFullyPaid: boolean,
  itemCodeByMenuId: Record<string, string> = {},
): CheckoutDisplayLine[] {
  if (isFullyPaid) {
    return checkoutLinesFromOrders(orders, itemCodeByMenuId);
  }

  const snapshotOrders = ordersForCloseSnapshot(orders, closedAt);
  if (snapshotOrders.length === 0) return [];

  return checkoutLinesFromOrders(
    ordersAsBillableDisplay(snapshotOrders),
    itemCodeByMenuId,
  );
}
