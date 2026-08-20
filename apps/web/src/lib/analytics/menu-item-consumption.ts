import type { SupabaseClient } from '@supabase/supabase-js';
import type { MenuItemAgg } from '@/lib/analytics/aggregate-items';
import { auditMoney } from '@/lib/audit/money';
import type {
  AnalyticsRange,
  MenuItemConsumptionRankRow,
  MenuItemConsumptionResponse,
} from '@/lib/analytics/analytics.types';
import { ANALYTICS_DAILY_SCHEMA_VERSION } from '@/lib/analytics/analytics.types';
import {
  fetchDailyMenuItemConsumption,
  isCountableConsumptionRow,
  type DailyMenuItemConsumptionRow,
} from '@/lib/analytics/daily-menu-item-consumption';
import {
  ANALYTICS_SEAL_LOOKBACK_DAYS,
} from '@/lib/analytics/analytics.service';
import {
  computeRestaurantBusinessDayMetrics,
  ensureMenuItemConsumptionSealed,
  ensureSealedClosedBusinessDays,
} from '@/lib/analytics/daily-stats';
import { resolveAnalyticsDateWindow } from '@/lib/analytics/date-window';
import { addCalendarDays } from '@/lib/lisbon-calendar';
import { isListPageSize, LIST_DEFAULT_PAGE_SIZE, type ListPageSize } from '@/lib/paginate-list';

/** Top slice of the full ranking shown as the summary bar (same sort as the list). */
export const MENU_ITEM_CONSUMPTION_TOP_N = 10;

export type GetMenuItemConsumptionResult =
  | { ok: true; data: MenuItemConsumptionResponse }
  | { ok: false; code: 'query_limit_exceeded' | 'query_failed'; message?: string };

export type MenuItemConsumptionPageParams = {
  page: number;
  pageSize: ListPageSize;
};

export function parseMenuItemConsumptionPageParams(input: {
  page: string | null;
  pageSize: string | null;
}): MenuItemConsumptionPageParams {
  const pageRaw = Number(input.page);
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;
  const sizeRaw = Number(input.pageSize);
  const pageSize: ListPageSize = isListPageSize(sizeRaw) ? sizeRaw : LIST_DEFAULT_PAGE_SIZE;
  return { page, pageSize };
}

function mergeAgg(
  map: Map<string, MenuItemAgg>,
  input: {
    itemId: string;
    itemCode: string | null;
    namePt: string;
    nameEn: string | null;
    nameZh: string | null;
    consumedQuantity: number;
    amount: number;
  },
) {
  const qty = Number(input.consumedQuantity) || 0;
  const amount = auditMoney(Number(input.amount) || 0);
  if (qty <= 0) return;

  const existing = map.get(input.itemId);
  if (!existing) {
    map.set(input.itemId, {
      itemId: input.itemId,
      itemCode: input.itemCode,
      namePt: input.namePt,
      nameEn: input.nameEn,
      nameZh: input.nameZh,
      consumedQuantity: qty,
      amount,
    });
    return;
  }

  existing.consumedQuantity += qty;
  existing.amount = auditMoney(existing.amount + amount);
  if (!existing.itemCode && input.itemCode) existing.itemCode = input.itemCode;
  if (!existing.nameEn && input.nameEn) existing.nameEn = input.nameEn;
  if (!existing.nameZh && input.nameZh) existing.nameZh = input.nameZh;
}

function foldSealedRows(rows: DailyMenuItemConsumptionRow[], map: Map<string, MenuItemAgg>) {
  for (const row of rows) {
    if (!isCountableConsumptionRow(row)) continue;
    mergeAgg(map, {
      itemId: row.menu_item_id,
      itemCode: row.item_code,
      namePt: row.name_pt,
      nameEn: row.name_en,
      nameZh: row.name_zh,
      consumedQuantity: row.consumed_quantity,
      amount: row.amount,
    });
  }
}

function toRankedRows(map: Map<string, MenuItemAgg>): MenuItemConsumptionRankRow[] {
  return Array.from(map.values())
    .sort(
      (a, b) =>
        b.consumedQuantity - a.consumedQuantity ||
        b.amount - a.amount ||
        a.itemId.localeCompare(b.itemId),
    )
    .map((item, index) => ({
      rank: index + 1,
      menuItemId: item.itemId,
      itemCode: item.itemCode ?? null,
      namePt: item.namePt,
      nameEn: item.nameEn ?? null,
      nameZh: item.nameZh ?? null,
      consumedQuantity: item.consumedQuantity,
      amount: item.amount,
    }));
}

/**
 * Full menu-item consumption ranking over the same date window as value-overview.
 * Sole durable source: analytics_daily_menu_item_consumption (+ today live).
 */
export async function getMenuItemConsumptionForRange(
  admin: SupabaseClient,
  restaurantId: string,
  range: AnalyticsRange,
  pageParams: MenuItemConsumptionPageParams,
  now: Date = new Date(),
): Promise<GetMenuItemConsumptionResult> {
  const window = resolveAnalyticsDateWindow(range, now);
  const historicalEnd =
    window.startDate < window.today
      ? addCalendarDays(window.today, -1)
      : window.startDate;

  const sealStartCandidate = addCalendarDays(window.today, -ANALYTICS_SEAL_LOOKBACK_DAYS);
  const sealStart =
    sealStartCandidate > window.startDate ? sealStartCandidate : window.startDate;

  const sealedEnsure = await ensureSealedClosedBusinessDays(
    admin,
    restaurantId,
    sealStart,
    historicalEnd,
    window.today,
  );
  if (!sealedEnsure.ok) {
    return { ok: false, code: sealedEnsure.code, message: sealedEnsure.message };
  }

  // Consumption backfill window matches the overview chart window (not only 7d lookback).
  const consumptionEnsure = await ensureMenuItemConsumptionSealed(
    admin,
    restaurantId,
    window.startDate,
    historicalEnd,
    window.today,
  );
  if (!consumptionEnsure.ok) {
    return {
      ok: false,
      code: consumptionEnsure.code,
      message: consumptionEnsure.message,
    };
  }

  const map = new Map<string, MenuItemAgg>();

  if (window.startDate < window.today) {
    const sealed = await fetchDailyMenuItemConsumption(
      admin,
      restaurantId,
      window.startDate,
      historicalEnd,
    );
    if (!sealed.ok) {
      return { ok: false, code: sealed.code, message: sealed.message };
    }
    foldSealedRows(sealed.rows, map);
  }

  const todayLive = await computeRestaurantBusinessDayMetrics(
    admin,
    restaurantId,
    window.today,
  );
  if (!todayLive.ok) {
    return { ok: false, code: todayLive.code, message: todayLive.message };
  }
  for (const item of todayLive.allItems) {
    mergeAgg(map, {
      itemId: item.itemId,
      itemCode: item.itemCode ?? null,
      namePt: item.namePt,
      nameEn: item.nameEn ?? null,
      nameZh: item.nameZh ?? null,
      consumedQuantity: item.consumedQuantity,
      amount: item.amount,
    });
  }

  const ranked = toRankedRows(map);
  const total = ranked.length;
  const { page, pageSize } = pageParams;
  const maxPage = Math.max(1, Math.ceil(total / pageSize) || 1);
  const safePage = Math.min(page, maxPage);
  const start = (safePage - 1) * pageSize;
  const items = ranked.slice(start, start + pageSize);
  const topItems = ranked.slice(0, MENU_ITEM_CONSUMPTION_TOP_N);

  return {
    ok: true,
    data: {
      range,
      schemaVersion: ANALYTICS_DAILY_SCHEMA_VERSION,
      startDate: window.startDate,
      endDate: window.endDate,
      topItems,
      items,
      page: safePage,
      pageSize,
      total,
    },
  };
}
