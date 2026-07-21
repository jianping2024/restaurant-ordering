import { checkoutSplitModeLabel } from '@/lib/checkout-settlement';
import { buildCheckoutPersonShareLines } from '@/lib/checkout-split-person-lines';
import {
  buildSplitSettlementRows,
  type SplitSettlementRow,
} from '@/lib/checkout-split-settlement';
import { buildOrderHistorySessionLines } from '@/lib/order-history/build-session-lines';
import type { OrderHistoryBillSplitSummary } from '@/lib/order-history-bill-splits';
import type { OrderHistoryEntry } from '@/lib/order-history/types';
import type { UILanguage } from '@/lib/i18n';
import { getMessages } from '@/lib/i18n/messages';
import type { CheckoutDisplayLine } from '@/lib/checkout-session-lines';
import type { CheckoutPersonShareLine } from '@/lib/checkout-split-person-lines';
import type { BillSplit } from '@/types';
import type { OrderHistoryCloseAnnotation } from '@/lib/order-history/types';

export type OrderHistoryPersonRow = SplitSettlementRow & {
  shareLines: CheckoutPersonShareLine[];
};

export type OrderHistoryBillDetailView = {
  tableLines: CheckoutDisplayLine[];
  tableLinesTotal: number;
  personRows: OrderHistoryPersonRow[];
  splitModeLabel: string | null;
  canExpandPersonDishes: boolean;
  showSplitSection: boolean;
};

function asBillSplitForHistory(split: OrderHistoryBillSplitSummary): BillSplit {
  return split as BillSplit;
}

export function buildOrderHistoryBillDetailView(
  entry: OrderHistoryEntry,
  itemCodeByMenuId: Record<string, string>,
  lang: UILanguage,
): OrderHistoryBillDetailView {
  const isFullyPaid = entry.settlement.outcome === 'fully_paid';
  const tableLines = buildOrderHistorySessionLines(
    entry.orders,
    entry.closedAt,
    isFullyPaid,
    itemCodeByMenuId,
  );

  const tableLinesTotal =
    entry.settlement.summary?.consumption ??
    entry.billSplit?.total_amount ??
    tableLines.reduce((sum, line) => sum + line.lineTotal, 0);

  const checkoutT = getMessages(lang).checkout;
  const splitModeLabel = entry.billSplit
    ? checkoutSplitModeLabel(entry.billSplit.split_mode, {
        even: checkoutT.splitModeEven,
        byItem: checkoutT.splitModeByItem,
        custom: checkoutT.splitModeCustom,
        wholeTable: checkoutT.splitModeWhole,
      })
    : null;

  const split = entry.billSplit;
  const resultRows = split?.result ?? [];
  const settlementRows = split
    ? buildSplitSettlementRows(resultRows, entry.settlement.collectedPayments)
    : [];

  const canExpandPersonDishes = split?.split_mode === 'by_item';
  const billSplitForLines = split ? asBillSplitForHistory(split) : null;

  const personRows: OrderHistoryPersonRow[] = settlementRows.map((row) => ({
    ...row,
    shareLines:
      billSplitForLines && canExpandPersonDishes
        ? buildCheckoutPersonShareLines(
            billSplitForLines,
            row.index,
            entry.orders,
            itemCodeByMenuId,
          )
        : [],
  }));

  const showSplitSection =
    personRows.length > 1 ||
    (!!split &&
      (split.split_mode === 'by_item' || split.split_mode === 'custom') &&
      personRows.length > 0);

  return {
    tableLines,
    tableLinesTotal,
    personRows,
    splitModeLabel,
    canExpandPersonDishes,
    showSplitSection,
  };
}

export function defaultOrderHistoryCloseAnnotation(
  sessionId: string,
  forcedBySession: Map<string, OrderHistoryCloseAnnotation>,
): OrderHistoryCloseAnnotation {
  return forcedBySession.get(sessionId) ?? { isForcedUnpaidClose: false };
}
