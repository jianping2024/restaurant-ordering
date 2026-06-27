import type { SupabaseClient } from '@supabase/supabase-js';
import { loadFrontdeskOperationalContext } from '@/lib/dashboard-access';
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
    }
  | { error: string; status: number; message?: string };

import { loadRestaurantTableGroups } from '@/lib/dashboard-table-groups-server';

export async function loadFrontdeskDashboardTables(): Promise<FrontdeskDashboardTables> {
  const ctx = await loadFrontdeskOperationalContext();
  if ('error' in ctx) {
    return { error: ctx.error, status: ctx.status };
  }

  const { data: restaurant, error: restaurantError } = await ctx.admin
    .from('restaurants')
    .select('id, name, slug, owner_id')
    .eq('id', ctx.restaurantId)
    .maybeSingle();

  if (restaurantError || !restaurant) {
    return { error: 'restaurant_not_found', status: 404, message: restaurantError?.message };
  }

  const { data, error } = await ctx.admin
    .from('restaurant_tables')
    .select('id, restaurant_id, display_name, sort_order, deleted_at, created_at')
    .eq('restaurant_id', ctx.restaurantId)
    .is('deleted_at', null);

  if (error) {
    return { error: 'tables_query_failed', status: 500, message: error.message };
  }

  const groupData = await loadRestaurantTableGroups(ctx.admin, ctx.restaurantId);
  if ('error' in groupData) {
    return {
      error: groupData.error,
      status: groupData.status,
      message: groupData.message,
    };
  }

  const tables = sortRestaurantTables((data || []) as RestaurantTable[]).map(
    ({ id, display_name, sort_order }) => ({ id, display_name, sort_order }),
  );

  return {
    admin: ctx.admin,
    restaurant: restaurant as { id: string; name: string; slug: string; owner_id: string },
    tables,
    groups: groupData.groups,
    members: groupData.members,
  };
}
