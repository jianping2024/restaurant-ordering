import type { SupabaseClient } from '@supabase/supabase-js';
import type { MenuItemAgg } from '@/lib/analytics/aggregate-items';
import type { AnalyticsQueryError } from '@/lib/analytics/analytics.repository';
import { ANALYTICS_FETCH_PAGE_SIZE, withAnalyticsQueryTimeout } from '@/lib/analytics/analytics.repository';

/**
 * Marker row when a sealed day had business activity but zero countable dishes.
 * Lets gap-fill detect “already sealed” without a second seal-flag column.
 * Filtered out of all ranking aggregates.
 */
export const EMPTY_DAY_CONSUMPTION_MENU_ITEM_ID = '__mesa_empty_day__';

export type DailyMenuItemConsumptionRow = {
  restaurant_id: string;
  business_date: string;
  menu_item_id: string;
  item_code: string | null;
  name_pt: string;
  name_en: string | null;
  name_zh: string | null;
  consumed_quantity: number;
  amount: number;
  sealed_at: string;
};

export function isCountableConsumptionRow(row: {
  menu_item_id: string;
  consumed_quantity: number;
}): boolean {
  return (
    row.menu_item_id !== EMPTY_DAY_CONSUMPTION_MENU_ITEM_ID &&
    (Number(row.consumed_quantity) || 0) > 0
  );
}

/** Replace sealed full-day dish consumption rows (sole write path with sealRestaurantBusinessDay). */
export async function replaceDailyMenuItemConsumption(
  admin: SupabaseClient,
  restaurantId: string,
  businessDate: string,
  items: MenuItemAgg[],
): Promise<{ ok: true } | AnalyticsQueryError> {
  const { error: deleteError } = await admin
    .from('analytics_daily_menu_item_consumption')
    .delete()
    .eq('restaurant_id', restaurantId)
    .eq('business_date', businessDate);

  if (deleteError) {
    return { ok: false, code: 'query_failed', message: deleteError.message };
  }

  const nowIso = new Date().toISOString();
  const rows =
    items.length === 0
      ? [
          {
            restaurant_id: restaurantId,
            business_date: businessDate,
            menu_item_id: EMPTY_DAY_CONSUMPTION_MENU_ITEM_ID,
            item_code: null,
            name_pt: '',
            name_en: null,
            name_zh: null,
            consumed_quantity: 0,
            amount: 0,
            sealed_at: nowIso,
          },
        ]
      : items.map((item) => ({
          restaurant_id: restaurantId,
          business_date: businessDate,
          menu_item_id: item.itemId,
          item_code: item.itemCode ?? null,
          name_pt: item.namePt,
          name_en: item.nameEn ?? null,
          name_zh: item.nameZh ?? null,
          consumed_quantity: item.consumedQuantity,
          amount: item.amount,
          sealed_at: nowIso,
        }));

  const { error: insertError } = await admin
    .from('analytics_daily_menu_item_consumption')
    .insert(rows);
  if (insertError) {
    return { ok: false, code: 'query_failed', message: insertError.message };
  }
  return { ok: true };
}

export async function fetchDailyMenuItemConsumption(
  admin: SupabaseClient,
  restaurantId: string,
  startDate: string,
  endDateInclusive: string,
): Promise<{ ok: true; rows: DailyMenuItemConsumptionRow[] } | AnalyticsQueryError> {
  try {
    const rows: DailyMenuItemConsumptionRow[] = [];
    let from = 0;
    for (;;) {
      const to = from + ANALYTICS_FETCH_PAGE_SIZE - 1;
      const { data, error } = (await withAnalyticsQueryTimeout(
        admin
          .from('analytics_daily_menu_item_consumption')
          .select(
            'restaurant_id, business_date, menu_item_id, item_code, name_pt, name_en, name_zh, consumed_quantity, amount, sealed_at',
          )
          .eq('restaurant_id', restaurantId)
          .gte('business_date', startDate)
          .lte('business_date', endDateInclusive)
          .order('business_date', { ascending: true })
          .order('menu_item_id', { ascending: true })
          .range(from, to),
      )) as {
        data: DailyMenuItemConsumptionRow[] | null;
        error: { message: string } | null;
      };

      if (error) {
        return { ok: false, code: 'query_failed', message: error.message };
      }
      const page = data || [];
      rows.push(...page);
      if (page.length < ANALYTICS_FETCH_PAGE_SIZE) break;
      from += ANALYTICS_FETCH_PAGE_SIZE;
    }
    return { ok: true, rows };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'query_failed';
    if (message === 'analytics_query_timeout') {
      return { ok: false, code: 'query_limit_exceeded' };
    }
    return { ok: false, code: 'query_failed', message };
  }
}

/** Lisbon business dates that already have at least one consumption row. */
export async function fetchSealedConsumptionBusinessDates(
  admin: SupabaseClient,
  restaurantId: string,
  startDate: string,
  endDateInclusive: string,
): Promise<{ ok: true; dates: string[] } | AnalyticsQueryError> {
  try {
    const dates = new Set<string>();
    let from = 0;
    for (;;) {
      const to = from + ANALYTICS_FETCH_PAGE_SIZE - 1;
      const { data, error } = (await withAnalyticsQueryTimeout(
        admin
          .from('analytics_daily_menu_item_consumption')
          .select('business_date')
          .eq('restaurant_id', restaurantId)
          .gte('business_date', startDate)
          .lte('business_date', endDateInclusive)
          .order('business_date', { ascending: true })
          .range(from, to),
      )) as {
        data: Array<{ business_date: string }> | null;
        error: { message: string } | null;
      };
      if (error) {
        return { ok: false, code: 'query_failed', message: error.message };
      }
      const page = data || [];
      for (const row of page) dates.add(row.business_date);
      if (page.length < ANALYTICS_FETCH_PAGE_SIZE) break;
      from += ANALYTICS_FETCH_PAGE_SIZE;
    }
    return { ok: true, dates: Array.from(dates).sort() };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'query_failed';
    if (message === 'analytics_query_timeout') {
      return { ok: false, code: 'query_limit_exceeded' };
    }
    return { ok: false, code: 'query_failed', message };
  }
}
