import { loadOwnerRestaurantWithSlug } from '@/lib/staff-dashboard-api';
import { sortRestaurantTables, type RestaurantTable, type RestaurantTableRow } from '@/lib/restaurant-tables';

export type OwnerDashboardTables =
  | {
      admin: Exclude<Awaited<ReturnType<typeof loadOwnerRestaurantWithSlug>>, { error: string }>['admin'];
      restaurant: { id: string; name: string; slug: string; owner_id: string };
      tables: RestaurantTableRow[];
    }
  | { error: string; status: number; message?: string };

export async function loadOwnerDashboardTables(): Promise<OwnerDashboardTables> {
  const loaded = await loadOwnerRestaurantWithSlug();
  if ('error' in loaded) return loaded;

  const { data, error } = await loaded.admin
    .from('restaurant_tables')
    .select('id, restaurant_id, display_name, sort_order, deleted_at, created_at')
    .eq('restaurant_id', loaded.restaurant.id)
    .is('deleted_at', null);

  if (error) {
    return { error: 'tables_query_failed', status: 500, message: error.message };
  }

  const tables = sortRestaurantTables((data || []) as RestaurantTable[]).map(
    ({ id, display_name, sort_order }) => ({ id, display_name, sort_order }),
  );

  return {
    admin: loaded.admin,
    restaurant: loaded.restaurant,
    tables,
  };
}
