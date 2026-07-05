import type { Order } from '@/types';
import type { OrderHistoryBillSplitSummary } from '@/lib/order-history-bill-splits';

export const ORDER_HISTORY_PAGE_SIZE = 10;
export const ORDER_HISTORY_MAX_TOTAL = 100;

export type OrderHistoryFilters = {
  tableIds: string[];
  closedFrom?: string;
  closedTo?: string;
};

export type OrderHistoryEntry = {
  sessionId: string;
  tableId: string;
  displayName: string;
  closedAt: string;
  openedByName: string | null;
  itemCount: number;
  settlementAmount: number | null;
  billSplit?: OrderHistoryBillSplitSummary;
  orders: Order[];
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
