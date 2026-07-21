import type { CheckoutSettlementSummary } from '@/lib/checkout-settlement';
import {
  totalCollectedAmount,
  type SessionCollectedPayment,
} from '@/lib/checkout-session-payments';
import type { SplitSettlementRow } from '@/lib/checkout-split-settlement';
import type { OrderHistoryBillSplitSummary } from '@/lib/order-history-bill-splits';
import type { OrderHistoryCloseOutcome } from '@/lib/order-history/types';
import { isWholeTablePayerName } from '@/lib/split-person-label';
import type { SplitMode } from '@/types';
import type { getMessages } from '@/lib/i18n/messages';

type OrderHistoryI18n = ReturnType<typeof getMessages>['orderHistory'];

export type OrderHistoryDetailSection = 'settlement' | 'table_items' | 'person_ledger';

export type OrderHistorySettlementVariant = 'settled_compact' | 'active_breakdown' | 'unpaid';

export type OrderHistoryOutcomeBadgeTone = 'success' | 'warning' | 'muted';

export type OrderHistoryPersonLedgerDisplayMode = 'settled' | 'partial' | 'obligation_only';

export type OrderHistoryOutcomeBadge = {
  label: string;
  tone: OrderHistoryOutcomeBadgeTone;
};

export function resolveOrderHistoryOutcomeBadge(
  outcome: OrderHistoryCloseOutcome,
  i18n: OrderHistoryI18n,
): OrderHistoryOutcomeBadge {
  switch (outcome) {
    case 'fully_paid':
      return { label: i18n.outcomeFullyPaid, tone: 'success' };
    case 'partially_collected_closed':
      return { label: i18n.outcomePartial, tone: 'warning' };
    case 'unpaid_closed':
      return { label: i18n.outcomeUnpaid, tone: 'warning' };
    case 'closed_without_billing':
      return { label: i18n.outcomeClosedWithoutBilling, tone: 'muted' };
  }
}

export function resolveSettlementVariant(
  outcome: OrderHistoryCloseOutcome,
): OrderHistorySettlementVariant | null {
  switch (outcome) {
    case 'fully_paid':
      return 'settled_compact';
    case 'partially_collected_closed':
      return 'active_breakdown';
    case 'unpaid_closed':
      return 'unpaid';
    case 'closed_without_billing':
      return null;
  }
}

export function shouldShowPersonLedger(
  rows: SplitSettlementRow[],
  split: OrderHistoryBillSplitSummary | undefined,
): boolean {
  if (rows.length === 0) return false;
  if (rows.length === 1 && isWholeTablePayerName(rows[0].name)) return false;
  if (rows.length > 1) return true;
  if (!split) return false;
  return split.split_mode === 'by_item' || split.split_mode === 'custom';
}

export function resolvePersonLedgerDisplayMode(
  row: SplitSettlementRow,
  outcome: OrderHistoryCloseOutcome,
  hasCollections: boolean,
): OrderHistoryPersonLedgerDisplayMode {
  if (!hasCollections || outcome === 'unpaid_closed') {
    return 'obligation_only';
  }
  if (row.settlementStatus === 'partial') {
    return 'partial';
  }
  if (row.settlementStatus === 'settled') {
    return 'settled';
  }
  if (row.collectedAmount > 0 && row.outstandingAmount <= 0) {
    return 'settled';
  }
  if (row.collectedAmount > 0) {
    return 'partial';
  }
  return 'obligation_only';
}

export function resolveSectionOrder(
  outcome: OrderHistoryCloseOutcome,
  showPersonLedger: boolean,
  splitMode: SplitMode | undefined,
  showSettlement: boolean,
): OrderHistoryDetailSection[] {
  const sections: OrderHistoryDetailSection[] = [];
  if (showSettlement) sections.push('settlement');

  const personBeforeTable =
    outcome === 'fully_paid' && showPersonLedger && splitMode === 'by_item';

  if (personBeforeTable) {
    sections.push('person_ledger', 'table_items');
  } else {
    sections.push('table_items');
    if (showPersonLedger) sections.push('person_ledger');
  }

  return sections;
}

export function resolveTableItemsDefaultOpen(
  lineCount: number,
  outcome: OrderHistoryCloseOutcome,
  showPersonLedger: boolean,
  splitMode: SplitMode | undefined,
): boolean {
  if (lineCount <= 3) return true;
  if (outcome !== 'fully_paid') return true;
  if (showPersonLedger && splitMode === 'by_item') return false;
  return false;
}

export function buildStatusStrip(
  outcome: OrderHistoryCloseOutcome,
  summary: CheckoutSettlementSummary | null,
  splitModeLabel: string | null,
  personCount: number,
  i18n: OrderHistoryI18n,
): string {
  switch (outcome) {
    case 'fully_paid': {
      const amount = (summary?.collected ?? 0).toFixed(2);
      const mode = splitModeLabel ?? '—';
      return i18n.detailStatusFullyPaid
        .replace('{amount}', amount)
        .replace('{splitMode}', mode)
        .replace('{personCount}', String(personCount));
    }
    case 'partially_collected_closed':
      return i18n.detailStatusPartial
        .replace('{collected}', (summary?.collected ?? 0).toFixed(2))
        .replace('{pending}', (summary?.pending ?? 0).toFixed(2));
    case 'unpaid_closed':
      return i18n.detailStatusUnpaid;
    case 'closed_without_billing':
      return i18n.detailStatusNoBilling;
  }
}

export function groupPaymentsByPersonIndex(
  payments: SessionCollectedPayment[],
): Map<number, SessionCollectedPayment[]> {
  const map = new Map<number, SessionCollectedPayment[]>();
  for (const payment of payments) {
    if (payment.person_index == null || payment.person_index < 0) continue;
    const list = map.get(payment.person_index) ?? [];
    list.push(payment);
    map.set(payment.person_index, list);
  }
  return map;
}

export function latestPaymentForPerson(
  payments: SessionCollectedPayment[],
): SessionCollectedPayment | null {
  if (payments.length === 0) return null;
  return payments.reduce((latest, payment) =>
    new Date(payment.created_at).getTime() > new Date(latest.created_at).getTime()
      ? payment
      : latest,
  );
}

export function resolvePersonLedgerFooter(
  rows: SplitSettlementRow[],
  collectedPayments: SessionCollectedPayment[],
  displayModes: OrderHistoryPersonLedgerDisplayMode[],
): { label: 'collected' | 'obligation'; amount: number } | null {
  const totalCollected = totalCollectedAmount(collectedPayments);
  if (totalCollected > 0) {
    return { label: 'collected', amount: totalCollected };
  }
  if (displayModes.length > 0 && displayModes.every((mode) => mode === 'obligation_only')) {
    const totalObligation = rows.reduce((sum, row) => sum + row.obligationAmount, 0);
    return { label: 'obligation', amount: totalObligation };
  }
  return null;
}
