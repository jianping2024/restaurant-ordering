import type { CheckoutSettlementSummary } from '@/lib/checkout-settlement';
import type { SessionCollectedPayment } from '@/lib/checkout-session-payments';
import type { OrderHistoryBillSplitRef } from '@/lib/order-history-bill-splits';
import type { OrderListDisplayChip } from '@/lib/order-list-display';

export type OrderHistoryCloseOutcome =
  | 'fully_paid'
  | 'partially_collected_closed'
  | 'unpaid_closed'
  | 'closed_without_billing';

export type OrderHistoryListAmountKind = 'paid' | 'collected';

export type OrderHistorySessionSettlement = {
  outcome: OrderHistoryCloseOutcome;
  summary: CheckoutSettlementSummary | null;
  /** When true, detail modal renders consumption / payable / collected / pending rows. */
  showFinancialDetails: boolean;
  collectedPayments: SessionCollectedPayment[];
  /** Hide void strikethrough when money was collected this session. */
  suppressVoidItemStyling: boolean;
  listAmount: number | null;
  listAmountKind: OrderHistoryListAmountKind | null;
  paidRevenue: number | null;
};

/** Lean list row — no orders, items, split.result, or collectedPayments. */
export type OrderHistoryListItem = {
  sessionId: string;
  tableId: string;
  displayName: string;
  closedAt: string;
  openedByName: string | null;
  itemCount: number;
  listAmount: number | null;
  listAmountKind: OrderHistoryListAmountKind | null;
  billSplit?: OrderHistoryBillSplitRef;
};

/** Self-contained detail for the history modal. */
export type OrderHistoryDetail = {
  sessionId: string;
  tableId: string;
  displayName: string;
  closedAt: string;
  openedByName: string | null;
  settlement: OrderHistorySessionSettlement;
  chips: OrderListDisplayChip[];
};

export const ORDER_HISTORY_PAGE_SIZE = 10;
export const ORDER_HISTORY_MAX_TOTAL = 100;

export type OrderHistoryFilters = {
  tableIds: string[];
  closedFrom?: string;
  closedTo?: string;
};

export type OrderHistoryQuery = OrderHistoryFilters & {
  restaurantId: string;
  ownerId: string;
  restaurantName: string;
  offset: number;
  limit: number;
  maxTotal?: number;
};

export type OrderHistoryPageResult = {
  items: OrderHistoryListItem[];
  cappedTotal: number;
  hasMore: boolean;
};
