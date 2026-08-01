import type { SupabaseClient } from '@supabase/supabase-js';
import type { MenuItemAgg } from '@/lib/analytics/aggregate-items';
import type { AnalyticsQueryError } from '@/lib/analytics/analytics.repository';

export type DailyMenuItemStatRow = {
  restaurant_id: string;
  business_date: string;
  rank: number;
  item_id: string;
  name_pt: string;
  name_en: string | null;
  name_zh: string | null;
  consumed_quantity: number;
  amount: number;
  sealed_at: string;
};

/** Replace sealed top-N rows for one Lisbon day (sole write path with sealRestaurantBusinessDay). */
export async function replaceDailyMenuItemStats(
  admin: SupabaseClient,
  restaurantId: string,
  businessDate: string,
  topItems: MenuItemAgg[],
): Promise<{ ok: true } | AnalyticsQueryError> {
  const { error: deleteError } = await admin
    .from('analytics_daily_menu_item_stats')
    .delete()
    .eq('restaurant_id', restaurantId)
    .eq('business_date', businessDate);

  if (deleteError) {
    return { ok: false, code: 'query_failed', message: deleteError.message };
  }

  if (topItems.length === 0) {
    return { ok: true };
  }

  const nowIso = new Date().toISOString();
  const rows = topItems.map((item, index) => ({
    restaurant_id: restaurantId,
    business_date: businessDate,
    rank: index + 1,
    item_id: item.itemId,
    name_pt: item.namePt,
    name_en: item.nameEn ?? null,
    name_zh: item.nameZh ?? null,
    consumed_quantity: item.consumedQuantity,
    amount: item.amount,
    sealed_at: nowIso,
  }));

  const { error: insertError } = await admin.from('analytics_daily_menu_item_stats').insert(rows);
  if (insertError) {
    return { ok: false, code: 'query_failed', message: insertError.message };
  }
  return { ok: true };
}

export async function fetchDailyMenuItemStats(
  admin: SupabaseClient,
  restaurantId: string,
  businessDate: string,
): Promise<{ ok: true; rows: DailyMenuItemStatRow[] } | AnalyticsQueryError> {
  const { data, error } = await admin
    .from('analytics_daily_menu_item_stats')
    .select(
      'restaurant_id, business_date, rank, item_id, name_pt, name_en, name_zh, consumed_quantity, amount, sealed_at',
    )
    .eq('restaurant_id', restaurantId)
    .eq('business_date', businessDate)
    .order('rank', { ascending: true });

  if (error) {
    return { ok: false, code: 'query_failed', message: error.message };
  }
  return { ok: true, rows: (data || []) as DailyMenuItemStatRow[] };
}
