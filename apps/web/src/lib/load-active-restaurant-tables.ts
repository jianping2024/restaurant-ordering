import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DEFAULT_TABLE_SEAT_MAX,
  DEFAULT_TABLE_SEAT_MIN,
  normalizeTableSeatCount,
  sortRestaurantTables,
  type RestaurantTable,
  type RestaurantTableRow,
} from '@/lib/restaurant-tables';

/** Sole load of active (non-deleted) restaurant tables for dashboard filters. */
export async function loadActiveRestaurantTableRows(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<
  | { ok: true; tables: RestaurantTableRow[] }
  | { ok: false; error: string; message?: string }
> {
  const { data, error } = await admin
    .from('restaurant_tables')
    .select('id, restaurant_id, display_name, sort_order, seat_min, seat_max, deleted_at, created_at')
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null);

  if (error) {
    return { ok: false, error: 'tables_query_failed', message: error.message };
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

  return { ok: true, tables };
}
