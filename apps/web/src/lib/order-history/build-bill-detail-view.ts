import { checkoutSplitModeLabel } from '@/lib/checkout-settlement';
import { buildCheckoutPersonShareLines } from '@/lib/checkout-split-person-lines';
import {
  buildSplitSettlementRows,
  isMultiPersonSplitBill,
  type SplitSettlementRow,
} from '@/lib/checkout-split-settlement';
import {
  buildStatusStrip,
  groupPaymentsByPersonIndex,
  latestPaymentForPerson,
  resolvePersonLedgerDisplayMode,
  resolvePersonLedgerFooter,
  resolveSectionOrder,
  resolveSettlementVariant,
  resolveTableItemsDefaultOpen,
  shouldShowPersonLedger,
  type OrderHistoryDetailSection,
  type OrderHistoryPersonLedgerDisplayMode,
  type OrderHistorySettlementVariant,
} from '@/lib/order-history/build-detail-presentation';
import { buildOrderHistorySessionLines } from '@/lib/order-history/build-session-lines';
import type { OrderHistoryBillSplitSummary } from '@/lib/order-history-bill-splits';
import type { OrderHistoryEntry } from '@/lib/order-history/types';
import type { UILanguage } from '@/lib/i18n';
import { getMessages } from '@/lib/i18n/messages';
import type { CheckoutDisplayLine } from '@/lib/checkout-session-lines';
import type { CheckoutPersonShareLine } from '@/lib/checkout-split-person-lines';
import type { CheckoutSettlementSummary } from '@/lib/checkout-settlement';
import type { SessionCollectedPayment } from '@/lib/checkout-session-payments';
import type { BillSplit } from '@/types';

export type OrderHistoryPersonLedgerRow = SplitSettlementRow & {
  shareLines: CheckoutPersonShareLine[];
  paymentCount: number;
  latestCollectedAt: string | null;
  displayMode: OrderHistoryPersonLedgerDisplayMode;
  printPayment: SessionCollectedPayment | null;
};

export type OrderHistoryPersonLedger = {
  show: boolean;
  rows: OrderHistoryPersonLedgerRow[];
  footer: { label: 'collected' | 'obligation'; amount: number } | null;
};

export type OrderHistorySettlementPresentation = {
  show: boolean;
  variant: OrderHistorySettlementVariant;
  summary: CheckoutSettlementSummary;
};

export type OrderHistoryDetailActions = {
  canPrintBill: boolean;
  canPrintSplitReceipts: boolean;
};

export type OrderHistoryBillDetailView = {
  statusStrip: string;
  settlement: OrderHistorySettlementPresentation | null;
  personLedger: OrderHistoryPersonLedger;
  tableLines: CheckoutDisplayLine[];
  tableLinesTotal: number;
  tableItemsDefaultOpen: boolean;
  sectionOrder: OrderHistoryDetailSection[];
  canExpandPersonDishes: boolean;
  actions: OrderHistoryDetailActions;
};

function asBillSplitForHistory(split: OrderHistoryBillSplitSummary): BillSplit {
  return split as BillSplit;
}

function buildPersonLedgerRows(
  settlementRows: SplitSettlementRow[],
  entry: OrderHistoryEntry,
  billSplitForLines: BillSplit | null,
  canExpandPersonDishes: boolean,
  itemCodeByMenuId: Record<string, string>,
): OrderHistoryPersonLedgerRow[] {
  const { outcome, collectedPayments } = entry.settlement;
  const hasCollections = collectedPayments.length > 0;
  const paymentsByPerson = groupPaymentsByPersonIndex(collectedPayments);

  return settlementRows.map((row) => {
    const personPayments = paymentsByPerson.get(row.index) ?? [];
    const displayMode = resolvePersonLedgerDisplayMode(row, outcome, hasCollections);

    return {
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
      paymentCount: personPayments.length,
      latestCollectedAt: latestPaymentForPerson(personPayments)?.created_at ?? null,
      displayMode,
      printPayment: latestPaymentForPerson(personPayments),
    };
  });
}

export function buildOrderHistoryBillDetailView(
  entry: OrderHistoryEntry,
  itemCodeByMenuId: Record<string, string>,
  lang: UILanguage,
): OrderHistoryBillDetailView {
  const { settlement } = entry;
  const isFullyPaid = settlement.outcome === 'fully_paid';
  const tableLines = buildOrderHistorySessionLines(
    entry.orders,
    entry.closedAt,
    isFullyPaid,
    itemCodeByMenuId,
  );

  const tableLinesTotal =
    settlement.summary?.consumption ??
    entry.billSplit?.total_amount ??
    tableLines.reduce((sum, line) => sum + line.lineTotal, 0);

  const checkoutT = getMessages(lang).checkout;
  const orderHistoryI18n = getMessages(lang).orderHistory;
  const split = entry.billSplit;
  const splitModeLabel = split
    ? checkoutSplitModeLabel(split.split_mode, {
        even: checkoutT.splitModeEven,
        byItem: checkoutT.splitModeByItem,
        custom: checkoutT.splitModeCustom,
        wholeTable: checkoutT.splitModeWhole,
      })
    : null;

  const resultRows = split?.result ?? [];
  const settlementRows = split
    ? buildSplitSettlementRows(resultRows, settlement.collectedPayments)
    : [];

  const canExpandPersonDishes = split?.split_mode === 'by_item';
  const billSplitForLines = split ? asBillSplitForHistory(split) : null;
  const personLedgerRows = buildPersonLedgerRows(
    settlementRows,
    entry,
    billSplitForLines,
    canExpandPersonDishes,
    itemCodeByMenuId,
  );

  const showPersonLedger = shouldShowPersonLedger(settlementRows, split);
  const settlementVariant = resolveSettlementVariant(settlement.outcome);
  const showSettlement = settlement.showFinancialDetails && settlement.summary != null && settlementVariant != null;

  const personLedger: OrderHistoryPersonLedger = {
    show: showPersonLedger,
    rows: personLedgerRows,
    footer: showPersonLedger
      ? resolvePersonLedgerFooter(
          settlementRows,
          settlement.collectedPayments,
          personLedgerRows.map((row) => row.displayMode),
        )
      : null,
  };

  const settlementPresentation: OrderHistorySettlementPresentation | null =
    showSettlement && settlement.summary && settlementVariant
      ? {
          show: true,
          variant: settlementVariant,
          summary: settlement.summary,
        }
      : null;

  return {
    statusStrip: buildStatusStrip(
      settlement.outcome,
      settlement.summary,
      splitModeLabel,
      resultRows.length,
      orderHistoryI18n,
    ),
    settlement: settlementPresentation,
    personLedger,
    tableLines,
    tableLinesTotal,
    tableItemsDefaultOpen: resolveTableItemsDefaultOpen(
      tableLines.length,
      settlement.outcome,
      showPersonLedger,
      split?.split_mode,
    ),
    sectionOrder: resolveSectionOrder(
      settlement.outcome,
      showPersonLedger,
      split?.split_mode,
      showSettlement,
    ),
    canExpandPersonDishes,
    actions: {
      canPrintBill: !!split,
      canPrintSplitReceipts:
        !!split && isMultiPersonSplitBill(split) && settlement.collectedPayments.length > 0,
    },
  };
}
