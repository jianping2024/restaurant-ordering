import type { SupabaseClient } from '@supabase/supabase-js';
import { getFrontdeskOperationalContext } from '@/lib/dashboard-access-cached';
import { loadRestaurantTableGroups } from '@/lib/dashboard-table-groups-server';
import {
  type RestaurantTableGroup,
  type RestaurantTableGroupMember,
} from '@/lib/restaurant-table-groups';
import { sortRestaurantTables, type RestaurantTable, type RestaurantTableRow } from '@/lib/restaurant-tables';

export type FrontdeskDashboardTables =
  | {
      admin: SupabaseClient;
      restaurant: { id: string; name: string; slug: string; owner_id: string };
      tables: RestaurantTableRow[];
      groups: RestaurantTableGroup[];
      members: RestaurantTableGroupMember[];
      occupiedTableIds: string[];
    }
  | { error: string; status: number; message?: string };

async function loadOccupiedTableIds(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<string[]> {
  const { data, error } = await admin
    .from('table_sessions')
    .select('table_id')
    .eq('restaurant_id', restaurantId)
    .in('status', ['open', 'billing']);

  if (error) return [];
  return (data || []).map((row) => row.table_id as string);
}

export async function loadFrontdeskDashboardTables(): Promise<FrontdeskDashboardTables> {
  const ctx = await getFrontdeskOperationalContext();
  if ('error' in ctx) {
    return { error: ctx.error, status: ctx.status };
  }

  const [restaurantResult, tablesResult, groupData, occupiedTableIds] = await Promise.all([
    ctx.admin
      .from('restaurants')
      .select('id, name, slug, owner_id')
      .eq('id', ctx.restaurantId)
      .maybeSingle(),
    ctx.admin
      .from('restaurant_tables')
      .select('id, restaurant_id, display_name, sort_order, seat_min, seat_max, deleted_at, created_at')
      .eq('restaurant_id', ctx.restaurantId)
      .is('deleted_at', null),
    loadRestaurantTableGroups(ctx.admin, ctx.restaurantId),
    loadOccupiedTableIds(ctx.admin, ctx.restaurantId),
  ]);

  const { data: restaurant, error: restaurantError } = restaurantResult;
  if (restaurantError || !restaurant) {
    return { error: 'restaurant_not_found', status: 404, message: restaurantError?.message };
  }

  const { data, error } = tablesResult;
  if (error) {
    return { error: 'tables_query_failed', status: 500, message: error.message };
  }

  if ('error' in groupData) {
    return {
      error: groupData.error,
      status: groupData.status,
      message: groupData.message,
    };
  }

  const tables = sortRestaurantTables((data || []) as RestaurantTable[]).map(
    ({ id, display_name, sort_order, seat_min, seat_max }) => ({
      id,
      display_name,
      sort_order,
      seat_min,
      seat_max,
    }),
  );

  return {
    admin: ctx.admin,
    restaurant: restaurant as { id: string; name: string; slug: string; owner_id: string },
    tables,
    groups: groupData.groups,
    members: groupData.members,
    occupiedTableIds,
  };
}
