import {
  billableLineAmount,
  buildBillableSessionItems,
  chargeableFieldsFromBillableRow,
} from '@/lib/billable-session-lines';
import { formatLocalizedMenuItemLabel, resolveMenuItemLocalizedName } from '@/lib/menu-item-display';
import { formatOrderItemQuantityLabel } from '@/lib/order-list-display';
import { resolveMenuItemCode } from '@/lib/menu-item-code';
import { isBuffetBaseItem } from '@/lib/order-items';
import type { UILanguage } from '@/lib/i18n';
import type { Order } from '@/types';

export type CheckoutDisplayLine = {
  key: string;
  /** Staff-facing primary text: `001 Água 500ml` or plain buffet name. */
  label: string;
  quantityLabel: string;
  lineTotal: number;
  /** Sushi limited dish: chargeable share (display stays one row). */
  chargeableQty?: number;
  chargeableUnitPrice?: number;
};

/** Billable lines for checkout detail (matches receipt enqueue aggregation). */
export function checkoutLinesFromOrders(
  orders: Order[],
  lang: UILanguage,
  itemCodeByMenuId: Record<string, string> = {},
): CheckoutDisplayLine[] {
  return buildBillableSessionItems(orders).map((row) => {
    const { key, item } = row;
    const itemCode = resolveMenuItemCode(item, itemCodeByMenuId);
    const label = isBuffetBaseItem(item)
      ? resolveMenuItemLocalizedName(item, lang)
      : formatLocalizedMenuItemLabel(item, lang, itemCode);

    return {
      key,
      label,
      quantityLabel: formatOrderItemQuantityLabel(item, { headcountStyle: 'receipt' }),
      lineTotal: billableLineAmount(row),
      ...chargeableFieldsFromBillableRow(row),
    };
  });
}
