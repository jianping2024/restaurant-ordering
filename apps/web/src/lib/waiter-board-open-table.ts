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

export type OpenTableReconcileOutcome =
  | { kind: 'confirmed_idle'; model: WaiterTablePageModel }
  | { kind: 'stale_occupied'; model: WaiterTablePageModel }
  | { kind: 'unavailable' };

/** Compare authoritative table page model against an idle open-table attempt. */
export function reconcileOpenTablePageModel(
  authoritative: WaiterTablePageModel,
): OpenTableReconcileOutcome {
  if (!authoritative.detail.table) {
    return { kind: 'unavailable' };
  }
  if (authoritative.detail.sessionMeta) {
    return { kind: 'stale_occupied', model: authoritative };
  }
  return { kind: 'confirmed_idle', model: authoritative };
}

export function activeBuffetsFromModel(model: WaiterTablePageModel) {
  return model.buffets.filter((b) => b.is_active);
}
