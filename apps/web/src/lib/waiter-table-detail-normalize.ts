import type { ResolvedBuffetPriceRow } from '@/lib/buffet-order';
import type { WaiterTableDetailData, WaiterTablePageModel } from '@/lib/waiter-table-detail-types';

export function normalizeWaiterTablePageModel(
  raw: Omit<WaiterTablePageModel, 'inTableParty'> & { inTableParty?: boolean },
): WaiterTablePageModel {
  return {
    detail: {
      table: raw.detail.table ?? null,
      sessionMeta: raw.detail.sessionMeta ?? null,
      orders: raw.detail.orders ?? [],
      checkoutRequested: !!raw.detail.checkoutRequested,
      checkoutRequestedAt: raw.detail.checkoutRequestedAt ?? null,
    },
    buffets: raw.buffets ?? [],
    buffetPricesByBuffetId: raw.buffetPricesByBuffetId ?? {},
    inTableParty: !!raw.inTableParty,
  };
}

export function defaultBuffetPriceFromModel(
  model: WaiterTablePageModel,
): ResolvedBuffetPriceRow | null {
  const buffet = model.buffets.find((b) => b.is_active) ?? null;
  if (!buffet) return null;
  return model.buffetPricesByBuffetId[buffet.id] ?? null;
}

/** Backward-compatible detail-only slice for buffet open API responses. */
export function detailFromPageModel(model: WaiterTablePageModel): WaiterTableDetailData {
  return model.detail;
}
