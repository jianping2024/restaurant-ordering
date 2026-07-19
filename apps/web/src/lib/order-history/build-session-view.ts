import {
  toOrderHistoryBillSplitRef,
  type OrderHistoryBillSplitSummary,
} from '@/lib/order-history-bill-splits';
import { buildOrderHistorySessionSettlement } from '@/lib/order-history/build-session-settlement';
import type {
  OrderHistoryDetail,
  OrderHistoryListItem,
  OrderHistorySessionSettlement,
} from '@/lib/order-history/types';
import {
  buildOrderHistoryDetailChips,
  countOrderListItems,
} from '@/lib/order-list-display';
import type { SessionCollectedPayment } from '@/lib/checkout-session-payments';
import type { Order } from '@/types';

export type OrderHistoryClosedSession = {
  id: string;
  table_id: string;
  closed_at: string;
  opened_by_user_id: string | null;
};

/** Internal snapshot: one settlement build feeds both list and detail projections. */
export type OrderHistorySessionView = {
  sessionId: string;
  tableId: string;
  displayName: string;
  closedAt: string;
  openedByName: string | null;
  itemCount: number;
  settlement: OrderHistorySessionSettlement;
  billSplit?: OrderHistoryBillSplitSummary;
  chips: OrderHistoryDetail['chips'];
};

function displayNameForSession(orders: Order[], tableId: string): string {
  const fromOrder = orders.find((order) => order.display_name?.trim())?.display_name?.trim();
  return fromOrder || tableId;
}

export function buildOrderHistorySessionView(input: {
  session: OrderHistoryClosedSession;
  orders: Order[];
  openedByName: string | null;
  billSplit?: OrderHistoryBillSplitSummary;
  collectedPayments: SessionCollectedPayment[];
}): OrderHistorySessionView {
  const { session, orders, openedByName, billSplit, collectedPayments } = input;
  const settlement = buildOrderHistorySessionSettlement({
    billSplit,
    collectedPayments,
    orders,
  });
  return {
    sessionId: session.id,
    tableId: session.table_id,
    displayName: displayNameForSession(orders, session.table_id),
    closedAt: session.closed_at,
    openedByName,
    itemCount: countOrderListItems(orders),
    settlement,
    billSplit,
    chips: buildOrderHistoryDetailChips(orders, {
      suppressVoidStyling: settlement.suppressVoidItemStyling,
    }),
  };
}

export function toOrderHistoryListItem(view: OrderHistorySessionView): OrderHistoryListItem {
  return {
    sessionId: view.sessionId,
    tableId: view.tableId,
    displayName: view.displayName,
    closedAt: view.closedAt,
    openedByName: view.openedByName,
    itemCount: view.itemCount,
    listAmount: view.settlement.listAmount,
    listAmountKind: view.settlement.listAmountKind,
    ...(view.billSplit ? { billSplit: toOrderHistoryBillSplitRef(view.billSplit) } : {}),
  };
}

export function toOrderHistoryDetail(view: OrderHistorySessionView): OrderHistoryDetail {
  return {
    sessionId: view.sessionId,
    tableId: view.tableId,
    displayName: view.displayName,
    closedAt: view.closedAt,
    openedByName: view.openedByName,
    settlement: view.settlement,
    chips: view.chips,
  };
}
