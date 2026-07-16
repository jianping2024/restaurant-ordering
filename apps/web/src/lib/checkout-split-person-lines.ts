import {
  byItemLinePriceShare,
  buffetShareUnitPrice,
  consumersForLineFromPersons,
  legacyAssigneeIdsForKey,
  legacyEqualLineShare,
  legacyEqualShareQtyLabel,
  shareQtyLabel,
} from '@/lib/bill-split-by-item';
import { buildBillSplitOrderLines, buildByItemLineSpec } from '@/lib/bill-split-by-item-lines';
import { checkoutLinesFromOrders } from '@/lib/checkout-session-lines';
import { orderItemReceiptLineLabel } from '@/lib/menu-print-label';
import type { BillSplit, Order } from '@/types';

/** One dish share for a by_item person (receipt + checkout UI). */
export type SplitPersonShareLine = {
  key: string;
  receiptLabel: string;
  quantityLabel: string;
  shareAmount: number;
};

/** Staff checkout detail row (prefers menu-code label when available). */
export type CheckoutPersonShareLine = {
  key: string;
  label: string;
  quantityLabel: string;
  shareAmount: number;
};

/**
 * Per-person dish shares for by_item splits. Empty for even/custom or missing person.
 * Amounts match split_payment receipt line unit prices (pre-discount).
 */
export function buildSplitPersonShareLines(
  split: BillSplit,
  personIndex: number,
  orders: Order[],
): SplitPersonShareLine[] {
  if (split.split_mode !== 'by_item') return [];

  const person = split.persons?.[personIndex];
  if (!person) return [];

  const persons = split.persons || [];
  const personId = `p${personIndex + 1}`;
  const catalogLines = buildBillSplitOrderLines(orders);
  const lines: SplitPersonShareLine[] = [];

  for (const catalogLine of catalogLines) {
    const key = catalogLine.key;
    const hasLine =
      person.item_shares?.some((share) => share.key === key) ||
      (person.items || []).includes(key);
    if (!hasLine) continue;

    const spec = buildByItemLineSpec(catalogLine);
    const consumers = consumersForLineFromPersons(persons, key, spec);
    if (consumers.length === 0) continue;

    const lineTotal = catalogLine.price * catalogLine.qty;
    const personShare = consumers.find((consumer) => consumer.name === person.name);
    if (!personShare) continue;

    const usesLegacyShares = !person.item_shares?.some((share) => share.key === key);
    const shareQty = personShare.qty.num / personShare.qty.den;
    const shareAmount = usesLegacyShares
      ? legacyEqualLineShare(lineTotal, legacyAssigneeIdsForKey(persons, key), personId)
      : spec.mode === 'buffet' && personShare.guestType
        ? buffetShareUnitPrice(catalogLine, personShare.guestType) * shareQty
        : byItemLinePriceShare(lineTotal, consumers, person.name);
    const quantityLabel = usesLegacyShares
      ? legacyEqualShareQtyLabel(catalogLine.qty, consumers.length)
      : shareQtyLabel(personShare.qty);

    lines.push({
      key,
      receiptLabel: orderItemReceiptLineLabel(catalogLine),
      quantityLabel,
      shareAmount,
    });
  }

  return lines;
}

/** Staff-facing labels for one by_item person (pending or collected expand). */
export function buildCheckoutPersonShareLines(
  split: BillSplit,
  personIndex: number,
  orders: Order[],
  itemCodeByMenuId: Record<string, string> = {},
): CheckoutPersonShareLine[] {
  const staffLabelByKey = new Map(
    checkoutLinesFromOrders(orders, itemCodeByMenuId).map((line) => [line.key, line.label]),
  );

  return buildSplitPersonShareLines(split, personIndex, orders).map((row) => ({
    key: row.key,
    label: staffLabelByKey.get(row.key) ?? row.receiptLabel,
    quantityLabel: row.quantityLabel,
    shareAmount: row.shareAmount,
  }));
}
