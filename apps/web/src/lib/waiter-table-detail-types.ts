import type { ResolvedBuffetPriceRow } from '@/lib/buffet-order';
import type { WaiterTableSessionMeta } from '@/lib/waiter-board-session';
import type { RestaurantTableRow } from '@/lib/restaurant-tables';
import type { Buffet, Order } from '@/types';

/** Session / orders / checkout slice shared by SSR, staff API, and client refresh. */
export type WaiterTableDetailData = {
  table: RestaurantTableRow | null;
  sessionMeta: WaiterTableSessionMeta | null;
  orders: Order[];
  checkoutRequested: boolean;
  checkoutRequestedAt: string | null;
};

/** Full waiter table detail page payload — single client/server contract. */
export type WaiterTablePageModel = {
  detail: WaiterTableDetailData;
  buffets: Buffet[];
  buffetPricesByBuffetId: Record<string, ResolvedBuffetPriceRow | null>;
};
