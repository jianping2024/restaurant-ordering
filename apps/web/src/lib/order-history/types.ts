import type { CheckoutSettlementSummary } from '@/lib/checkout-settlement';
import type { SessionCollectedPayment } from '@/lib/checkout-session-payments';
import type { OrderHistoryBillSplitSummary } from '@/lib/order-history-bill-splits';
import type { Order } from '@/types';

export type OrderHistoryCloseOutcome =
  | 'fully_paid'
  | 'partially_collected_closed'
  | 'unpaid_closed'
  | 'closed_without_billing';

export type OrderHistoryListAmountKind = 'paid' | 'collected';

export type OrderHistoryPersonBalance = {
  name: string;
  owed: number;
  collected: number;
  outstanding: number;
};

export type OrderHistorySessionSettlement = {
  outcome: OrderHistoryCloseOutcome;
  summary: CheckoutSettlementSummary | null;
  /** When true, detail modal renders consumption / payable / collected / pending rows. */
  showFinancialDetails: boolean;
  collectedPayments: SessionCollectedPayment[];
  personBalances: OrderHistoryPersonBalance[];
  /** Hide void strikethrough when money was collected this session. */
  suppressVoidItemStyling: boolean;
  listAmount: number | null;
  listAmountKind: OrderHistoryListAmountKind | null;
  paidRevenue: number | null;
};

export type OrderHistoryEntry = {
  sessionId: string;
  tableId: string;
  displayName: string;
  closedAt: string;
  openedByName: string | null;
  itemCount: number;
  settlement: OrderHistorySessionSettlement;
  billSplit?: OrderHistoryBillSplitSummary;
  orders: Order[];
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
  items: OrderHistoryEntry[];
  cappedTotal: number;
  hasMore: boolean;
};
