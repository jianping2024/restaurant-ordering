import type { Buffet, Order } from '@/types';
import type { ResolvedBuffetPriceRow } from '@/lib/buffet-order';
import type { RestaurantTableRow } from '@/lib/restaurant-tables';
import type { WaiterTableSessionMeta } from '@/lib/waiter-board-session';
import type { WaiterTableDetailData, WaiterTablePageModel } from '@/lib/waiter-table-detail-types';

export type WaiterTableDetailSnapshot =
  | {
      kind: 'idle';
      table: RestaurantTableRow;
      buffets: Buffet[];
      buffetPricesByBuffetId: Record<string, ResolvedBuffetPriceRow | null>;
    }
  | {
      kind: 'active';
      table: RestaurantTableRow;
      buffets: Buffet[];
      sessionMeta: WaiterTableSessionMeta;
      orders: Order[];
      checkoutRequested: boolean;
      checkoutRequestedAt: string | null;
      buffetPricesByBuffetId: Record<string, ResolvedBuffetPriceRow | null>;
    };

export function snapshotToDetailData(snapshot: WaiterTableDetailSnapshot): WaiterTableDetailData {
  if (snapshot.kind === 'idle') {
    return {
      table: snapshot.table,
      sessionMeta: null,
      orders: [],
      checkoutRequested: false,
      checkoutRequestedAt: null,
    };
  }
  return {
    table: snapshot.table,
    sessionMeta: snapshot.sessionMeta,
    orders: snapshot.orders,
    checkoutRequested: snapshot.checkoutRequested,
    checkoutRequestedAt: snapshot.checkoutRequestedAt,
  };
}

export function snapshotToPageModel(
  snapshot: WaiterTableDetailSnapshot,
  inTableParty = false,
): WaiterTablePageModel {
  return {
    detail: snapshotToDetailData(snapshot),
    buffets: snapshot.buffets,
    buffetPricesByBuffetId: snapshot.buffetPricesByBuffetId,
    inTableParty,
  };
}
