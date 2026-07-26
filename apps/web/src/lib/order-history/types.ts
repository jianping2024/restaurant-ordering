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

export type OrderHistorySessionSettlement = {
  outcome: OrderHistoryCloseOutcome;
  summary: CheckoutSettlementSummary | null;
  /** When true, detail modal renders consumption / payable / collected / pending rows. */
  showFinancialDetails: boolean;
  collectedPayments: SessionCollectedPayment[];
  listAmount: number | null;
  listAmountKind: OrderHistoryListAmountKind | null;
  paidRevenue: number | null;
  /** Single print gate: fully_paid with printable order lines. */
  canPrintBill: boolean;
};

export type OrderHistoryCloseAnnotation =
  | {
      isForcedUnpaidClose: true;
      reasonCode: string;
      reasonDetail: string | null;
    }
  | {
      isForcedUnpaidClose: false;
    };

export type OrderHistoryEntry = {
  sessionId: string;
  tableId: string;
  displayName: string;
  /** Session open timestamp; null only for legacy/corrupt rows. */
  openedAt: string | null;
  openedByName: string | null;
  closedAt: string;
  closedByName: string | null;
  /** Raw closed_reason for lifecycle labels (nightly / merge); not a second outcome. */
  closedReason: string | null;
  itemCount: number;
  settlement: OrderHistorySessionSettlement;
  closeAnnotation: OrderHistoryCloseAnnotation;
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
  itemCodeByMenuId: Record<string, string>;
};
