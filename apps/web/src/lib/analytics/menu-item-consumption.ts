import type { SupabaseClient } from '@supabase/supabase-js';
import type { MenuItemAgg } from '@/lib/analytics/aggregate-items';
import { auditMoney } from '@/lib/audit/money';
import type {
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
  computeRestaurantBusinessDayMetrics,
  ensureMenuItemConsumptionSealed,
  ensureSealedClosedBusinessDays,
} from '@/lib/analytics/daily-stats';
import { ANALYTICS_SEAL_LOOKBACK_DAYS } from '@/lib/analytics/analytics.service';
import {
  clampConsumptionPeriod,
  defaultConsumptionPeriod,
  resolveConsumptionPeriodWindow,
  type MenuItemConsumptionGrain,
  type MenuItemConsumptionSort,
} from '@/lib/analytics/menu-item-consumption-period';
import { addCalendarDays, calendarDateInTimezone } from '@/lib/lisbon-calendar';
import { isListPageSize, LIST_DEFAULT_PAGE_SIZE, type ListPageSize } from '@/lib/paginate-list';

export {
  parseMenuItemConsumptionGrain,
  parseMenuItemConsumptionSort,
} from '@/lib/analytics/menu-item-consumption-period';

export type GetMenuItemConsumptionResult =
  | { ok: true; data: MenuItemConsumptionResponse }
  | { ok: false; code: 'query_limit_exceeded' | 'query_failed' | 'invalid_period'; message?: string };

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

/** Absolute rank by qty desc (1 = highest). */
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

/** Earliest Lisbon business day with restaurant daily stats (sole “有数据起” anchor). */
export async function fetchEarliestRestaurantBusinessDate(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<{ ok: true; earliest: string | null } | { ok: false; code: 'query_failed'; message: string }> {
  const { data, error } = await admin
    .from('analytics_daily_restaurant_stats')
    .select('business_date')
    .eq('restaurant_id', restaurantId)
    .order('business_date', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    return { ok: false, code: 'query_failed', message: error.message };
  }
  const earliest = data?.business_date ? String(data.business_date).slice(0, 10) : null;
  return { ok: true, earliest };
}

/**
 * Full menu-item consumption ranking for one month/quarter/year period.
 * Sole durable source: analytics_daily_menu_item_consumption (+ today live when period includes today).
 */
export async function getMenuItemConsumptionForPeriod(
  admin: SupabaseClient,
  restaurantId: string,
  grain: MenuItemConsumptionGrain,
  periodRaw: string | null,
  sort: MenuItemConsumptionSort,
  pageParams: MenuItemConsumptionPageParams,
  now: Date = new Date(),
): Promise<GetMenuItemConsumptionResult> {
  const today = calendarDateInTimezone(now);
  const earliestResult = await fetchEarliestRestaurantBusinessDate(admin, restaurantId);
  if (!earliestResult.ok) {
    return { ok: false, code: earliestResult.code, message: earliestResult.message };
  }
  const earliestBusinessDate = earliestResult.earliest;

  const period = clampConsumptionPeriod(
    grain,
    periodRaw || defaultConsumptionPeriod(grain, today),
    today,
    earliestBusinessDate,
  );
  const window = resolveConsumptionPeriodWindow(grain, period, today);
  if (!window) {
    return { ok: false, code: 'invalid_period' };
  }

  const { startDate, endDate } = window;
  const historicalEnd = endDate < today ? endDate : addCalendarDays(today, -1);

  const sealStartCandidate = addCalendarDays(today, -ANALYTICS_SEAL_LOOKBACK_DAYS);
  const sealStart = sealStartCandidate > startDate ? sealStartCandidate : startDate;

  if (startDate <= historicalEnd) {
    const sealedEnsure = await ensureSealedClosedBusinessDays(
      admin,
      restaurantId,
      sealStart,
      historicalEnd,
      today,
    );
    if (!sealedEnsure.ok) {
      return { ok: false, code: sealedEnsure.code, message: sealedEnsure.message };
    }

    const consumptionEnsure = await ensureMenuItemConsumptionSealed(
      admin,
      restaurantId,
      startDate,
      historicalEnd,
      today,
    );
    if (!consumptionEnsure.ok) {
      return {
        ok: false,
        code: consumptionEnsure.code,
        message: consumptionEnsure.message,
      };
    }
  }

  const map = new Map<string, MenuItemAgg>();

  if (startDate <= historicalEnd) {
    const sealed = await fetchDailyMenuItemConsumption(
      admin,
      restaurantId,
      startDate,
      historicalEnd,
    );
    if (!sealed.ok) {
      return { ok: false, code: sealed.code, message: sealed.message };
    }
    foldSealedRows(sealed.rows, map);
  }

  if (endDate >= today && startDate <= today) {
    const todayLive = await computeRestaurantBusinessDayMetrics(admin, restaurantId, today);
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
  }

  const rankedDesc = toRankedRows(map);
  const ordered = sort === 'asc' ? [...rankedDesc].reverse() : rankedDesc;
  const total = ordered.length;
  const { page, pageSize } = pageParams;
  const maxPage = Math.max(1, Math.ceil(total / pageSize) || 1);
  const safePage = Math.min(page, maxPage);
  const start = (safePage - 1) * pageSize;
  const items = ordered.slice(start, start + pageSize);

  return {
    ok: true,
    data: {
      grain,
      period,
      sort,
      schemaVersion: ANALYTICS_DAILY_SCHEMA_VERSION,
      startDate,
      endDate,
      earliestBusinessDate,
      items,
      page: safePage,
      pageSize,
      total,
    },
  };
}
