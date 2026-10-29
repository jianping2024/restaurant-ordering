import {
  billableLineAmount,
  buildPaperBillableSessionItems,
  chargeableFieldsFromBillableRow,
} from '@/lib/billable-session-lines';
import { formatLocalizedMenuItemLabel, resolveMenuItemLocalizedName } from '@/lib/menu-item-display';
import { formatOrderItemQuantityLabel } from '@/lib/order-list-display';
import { resolveMenuItemCode } from '@/lib/menu-item-code';
import {
  isBuffetBaseItem,
  isPackagingChargeItem,
  isTakeawayChargeItem,
} from '@/lib/order-items';
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
  /**
   * Removable checkout supply line id — dine-in Take away (`takeaway:…`) or
   * takeaway-session packaging (`packaging:…`).
   */
  chargeLineId?: string;
};

/** Sole count of removable supply rows (packaging / Take away) on a checkout dish list. */
export function countCheckoutSupplyChargeLines(lines: readonly CheckoutDisplayLine[]): number {
  let n = 0;
  for (const line of lines) {
    if (line.chargeLineId) n += 1;
  }
  return n;
}

/**
 * Sole checkout / bill / order-history money lines — same catalog as paper
 * ({@link buildPaperBillableSessionItems}: omits €0 free rows).
 */
export function checkoutLinesFromOrders(
  orders: Order[],
  lang: UILanguage,
  itemCodeByMenuId: Record<string, string> = {},
): CheckoutDisplayLine[] {
  return buildPaperBillableSessionItems(orders).map((row) => {
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
      ...(isTakeawayChargeItem(item) || isPackagingChargeItem(item)
        ? { chargeLineId: item.id }
        : {}),
    };
  });
}
