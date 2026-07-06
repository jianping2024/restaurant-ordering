import type { SupabaseClient } from '@supabase/supabase-js';
import { loadOverviewDashboardContext } from '@/lib/dashboard-access';
import { sortRestaurantTables, type RestaurantTable, type RestaurantTableRow, normalizeTableSeatCount, DEFAULT_TABLE_SEAT_MIN, DEFAULT_TABLE_SEAT_MAX } from '@/lib/restaurant-tables';

export type OrderHistoryDashboardContext =
  | {
      admin: SupabaseClient;
      restaurant: { id: string; name: string; slug: string; owner_id: string };
      tables: RestaurantTableRow[];
    }
  | { error: string; status: number };

export async function loadOrderHistoryDashboardContext(): Promise<OrderHistoryDashboardContext> {
  const ctx = await loadOverviewDashboardContext();
  if ('error' in ctx) return ctx;

  const { data: restaurant, error: restaurantError } = await ctx.admin
    .from('restaurants')
    .select('id, name, slug, owner_id')
    .eq('id', ctx.restaurantId)
    .maybeSingle();

  if (restaurantError || !restaurant) {
    return { error: 'restaurant_not_found', status: 404 };
  }

  const { data, error } = await ctx.admin
    .from('restaurant_tables')
    .select('id, restaurant_id, display_name, sort_order, seat_min, seat_max, deleted_at, created_at')
    .eq('restaurant_id', ctx.restaurantId)
    .is('deleted_at', null);

  if (error) {
    return { error: 'tables_query_failed', status: 500 };
  }

  const tables = sortRestaurantTables((data || []) as RestaurantTable[]).map(
    ({ id, display_name, sort_order, seat_min, seat_max }) => ({
      id,
      display_name,
      sort_order,
      seat_min: normalizeTableSeatCount(seat_min, DEFAULT_TABLE_SEAT_MIN),
      seat_max: normalizeTableSeatCount(seat_max, DEFAULT_TABLE_SEAT_MAX),
    }),
  );

  return {
    admin: ctx.admin,
    restaurant: restaurant as { id: string; name: string; slug: string; owner_id: string },
    tables,
  };
}
