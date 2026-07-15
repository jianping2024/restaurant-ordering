import { buildBillableSessionItems } from '@/lib/billable-session-lines';
import {
  formatOrderItemPlainName,
  formatOrderItemQuantityLabel,
  formatStaffMenuLineLabel,
} from '@/lib/order-list-display';
import { resolveMenuItemCode } from '@/lib/menu-item-code';
import { isBuffetBaseItem } from '@/lib/order-items';
import type { Order } from '@/types';

export type CheckoutDisplayLine = {
  key: string;
  /** Staff-facing primary text: `001 Água 500ml` or plain buffet name. */
  label: string;
  quantityLabel: string;
  lineTotal: number;
};

/** Billable lines for checkout detail (matches receipt enqueue aggregation). */
export function checkoutLinesFromOrders(
  orders: Order[],
  itemCodeByMenuId: Record<string, string> = {},
): CheckoutDisplayLine[] {
  return buildBillableSessionItems(orders).map(({ key, item }) => {
    const itemCode = resolveMenuItemCode(item, itemCodeByMenuId);
    const label = isBuffetBaseItem(item)
      ? formatOrderItemPlainName(item)
      : formatStaffMenuLineLabel(item, itemCode);

    return {
      key,
      label,
      quantityLabel: formatOrderItemQuantityLabel(item, { headcountStyle: 'receipt' }),
      lineTotal: item.price * item.qty,
    };
  });
}
