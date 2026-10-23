import type { SupabaseClient } from '@supabase/supabase-js';
import { getDashboardOperationalContext } from '@/lib/dashboard-access-cached';
import { loadActiveRestaurantTableRows } from '@/lib/load-active-restaurant-tables';
import type { RestaurantTableRow } from '@/lib/restaurant-tables';

export type OrderHistoryDashboardContext =
  | {
      admin: SupabaseClient;
      restaurant: { id: string; name: string; slug: string; owner_id: string };
      tables: RestaurantTableRow[];
    }
  | { error: string; status: number };

export async function loadOrderHistoryDashboardContext(): Promise<OrderHistoryDashboardContext> {
  const ctx = await getDashboardOperationalContext('dashboard.orders.view');
  if ('error' in ctx) return ctx;

  const { data: restaurant, error: restaurantError } = await ctx.admin
    .from('restaurants')
    .select('id, name, slug, owner_id')
    .eq('id', ctx.restaurantId)
    .maybeSingle();

  if (restaurantError || !restaurant) {
    return { error: 'restaurant_not_found', status: 404 };
  }

  const tablesResult = await loadActiveRestaurantTableRows(ctx.admin, ctx.restaurantId);
  if (!tablesResult.ok) {
    return { error: tablesResult.error, status: 500 };
  }

  return {
    admin: ctx.admin,
    restaurant: restaurant as { id: string; name: string; slug: string; owner_id: string },
    tables: tablesResult.tables,
  };
}
