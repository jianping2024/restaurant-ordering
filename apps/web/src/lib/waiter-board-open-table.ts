import type { ResolvedBuffetPriceRow } from '@/lib/buffet-order';
import type { RestaurantTableRow } from '@/lib/restaurant-tables';
import { snapshotToPageModel } from '@/lib/waiter-table-detail-snapshot';
import type { WaiterTablePageModel } from '@/lib/waiter-table-detail-types';
import type { Buffet } from '@/types';

/** Restaurant-level buffet + price seed carried on the waiter board read model. */
export type WaiterBoardOpenTableDefaults = {
  buffets: Buffet[];
  buffetPricesByBuffetId: Record<string, ResolvedBuffetPriceRow | null>;
};

/** True when the board carries buffet open-table seed (server sets this only with active buffets). */
export function boardSupportsBuffetOpenTable(
  openTableDefaults: WaiterBoardOpenTableDefaults | null,
): boolean {
  return openTableDefaults != null;
}

export function buildIdleOpenTablePageModel(
  defaults: WaiterBoardOpenTableDefaults,
  table: RestaurantTableRow,
): WaiterTablePageModel {
  return snapshotToPageModel({
    kind: 'idle',
    table,
    buffets: defaults.buffets,
    buffetPricesByBuffetId: defaults.buffetPricesByBuffetId,
  });
}

export function activeBuffetsFromModel(model: WaiterTablePageModel) {
  return model.buffets.filter((b) => b.is_active);
}

/** True when an idle open-table attempt must stop because the table already has a session. */
export function isTableOccupiedForIdleOpen(model: WaiterTablePageModel): boolean {
  return model.detail.sessionMeta != null;
}
