import type { SupabaseClient } from '@supabase/supabase-js';
import { loadFrontdeskOperationalContext } from '@/lib/dashboard-access';
import {
  sortTableGroups,
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

async function loadRestaurantTableGroups(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<
  | { groups: RestaurantTableGroup[]; members: RestaurantTableGroupMember[] }
  | { error: string; message?: string }
> {
  const [{ data: groups, error: groupsError }, { data: members, error: membersError }] =
    await Promise.all([
      admin
        .from('restaurant_table_groups')
        .select('id, restaurant_id, name, remarks, sort_order, created_at')
        .eq('restaurant_id', restaurantId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
      admin
        .from('restaurant_table_group_members')
        .select('group_id, table_id, restaurant_id')
        .eq('restaurant_id', restaurantId),
    ]);

  if (groupsError) {
    return { error: 'table_groups_query_failed', message: groupsError.message };
  }
  if (membersError) {
    return { error: 'table_group_members_query_failed', message: membersError.message };
  }

  return {
    groups: sortTableGroups((groups || []) as RestaurantTableGroup[]),
    members: (members || []) as RestaurantTableGroupMember[],
  };
}

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
      status: 500 as const,
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
