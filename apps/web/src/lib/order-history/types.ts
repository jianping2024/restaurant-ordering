import type { CheckoutSettlementSummary } from '@/lib/checkout-settlement';
import type { SessionCollectedPayment } from '@/lib/checkout-session-payments';
import type { OrderHistoryBillSplitSummary } from '@/lib/order-history-bill-splits';
import type { OrderHistoryCloseKind, OrderHistoryMergeTargetStatus } from '@/lib/order-history/close-kind';
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

export type OrderHistoryMergeTargetContext = {
  targetSessionId: string;
  targetTableId: string;
  targetDisplayName: string;
  targetStatus: OrderHistoryMergeTargetStatus;
};

export type OrderHistoryMergeSourceRef = {
  sourceSessionId: string;
  sourceTableId: string;
  sourceDisplayName: string;
  mergedAt: string;
  mergedByName: string | null;
};

export type OrderHistoryTransferEvent = {
  id: string;
  occurredAt: string;
  operatorUserId: string | null;
  operatorName: string | null;
  fromTableId: string;
  toTableId: string;
  fromDisplayName: string;
  toDisplayName: string;
};

export type OrderHistoryLifecycleStepKind =
  | 'opened'
  | 'transferred'
  | 'transferred_out'
  | 'merged_in'
  | 'merged_out'
  | 'closed';

export type OrderHistoryLifecycleStep = {
  kind: OrderHistoryLifecycleStepKind;
  at: string;
  operatorName: string | null;
  detail: string | null;
  sortKey: string;
  relatedSessionId?: string;
  systemClose?: boolean;
};

export type OrderHistoryEntry = {
  /** Stable list key: session id for billing closes; `transfer:{eventId}` for transfer-out rows. */
  historyRecordId: string;
  sessionId: string;
  tableId: string;
  displayName: string;
  closeKind: OrderHistoryCloseKind;
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
  /** Continued meal on target table (merge-out or transfer-out source rows). */
  mergeContext?: OrderHistoryMergeTargetContext;
  /** Direct tables merged into this billing session. */
  mergeSources?: OrderHistoryMergeSourceRef[];
  /** Mid-session transfers (chronological). */
  transferEvents?: OrderHistoryTransferEvent[];
  /** Ordered lifecycle for list + detail (composed in lib). */
  lifecycleSteps: OrderHistoryLifecycleStep[];
  billSplit?: OrderHistoryBillSplitSummary;
  orders: Order[];
};

export type OrderHistoryFilters = {
  tableIds: string[];
  closedFrom?: string;
  closedTo?: string;
  /** When set, load that closed session by id (deep link from abnormal ops). */
  sessionId?: string;
};

export type OrderHistoryQuery = OrderHistoryFilters & {
  restaurantId: string;
  ownerId: string;
  restaurantName: string;
  offset: number;
  limit: number;
};

export type OrderHistoryPageResult = {
  items: OrderHistoryEntry[];
  /** Matching rows in the active closed-date window (or 1 for sessionId deep link). */
  total: number;
  itemCodeByMenuId: Record<string, string>;
};
