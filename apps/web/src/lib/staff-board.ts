import { cache } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Order } from '@/types';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  sortTableGroups,
  type RestaurantTableGroup,
  type RestaurantTableGroupMember,
} from '@/lib/restaurant-table-groups';
import { compareRestaurantTables, sortRestaurantTables, type RestaurantTableRow } from '@/lib/restaurant-tables';
import { fetchCheckoutRequestedBoard } from '@/lib/table-checkout-pending';
import type { WaiterTableSessionMeta } from '@/lib/waiter-board-session';
import {
  filterOrdersInActiveSessions,
} from '@/lib/waiter-board-query';
import { buildActiveSessionMetaByTableId } from '@/lib/waiter-table-session-meta';
import {
  filterWaiterTableActionTargets,
} from '@/lib/waiter-table-occupancy';
import {
  buildWaiterBoardTableSummaries,
  type WaiterBoardTableSummary,
} from '@/lib/waiter-board-snapshot';
import { loadWaiterTablePageModel, resolveOpenTableBuffetPrices } from '@/lib/waiter-table-detail-load';
import type { WaiterBoardOpenTableDefaults } from '@/lib/waiter-board-open-table';
import type { WaiterTableDetailData } from '@/lib/waiter-table-detail-types';
import { loadTablePartyGroups } from '@/lib/table-party-groups-server';
import {
  tablePartyMemberTableIds,
  type TablePartyGroup,
  type TablePartyGroupMember,
} from '@/lib/table-party-groups';
import type { Buffet } from '@/types';
import { toKitchenBoardOrder, toKitchenBoardTable } from '@/lib/kitchen-board-types';

export type { WaiterTableDetailData } from '@/lib/waiter-table-detail-types';
export type { WaiterTablePageModel } from '@/lib/waiter-table-detail-types';
export type { WaiterBoardOpenTableDefaults } from '@/lib/waiter-board-open-table';

export type WaiterBoardData = {
  sessionMetaByTableId: Record<string, WaiterTableSessionMeta>;
  checkoutRequestedTableIds: string[];
  checkoutRequestedAtByTableId: Record<string, string>;
  tables: RestaurantTableRow[];
  groups: RestaurantTableGroup[];
  members: RestaurantTableGroupMember[];
  /** Runtime「同行组」— board marker; blocks self transfer/merge; excluded from merge targets. */
  parties: TablePartyGroup[];
  partyMembers: TablePartyGroupMember[];
  tableSummaries: WaiterBoardTableSummary[];
  restaurantHasActiveBuffets: boolean;
  /** Restaurant-level seed for idle-table open sheet — avoids per-click full page fetch for display. */
  openTableDefaults: WaiterBoardOpenTableDefaults | null;
};

export async function fetchWaiterTablePageModel(
  admin: SupabaseClient,
  restaurantId: string,
  tableId: string,
) {
  return loadWaiterTablePageModel(admin, restaurantId, tableId);
}

export async function fetchWaiterTableDetail(
  admin: SupabaseClient,
  restaurantId: string,
  tableId: string,
): Promise<WaiterTableDetailData> {
  const model = await loadWaiterTablePageModel(admin, restaurantId, tableId);
  if (!model) {
    return {
      table: null,
      sessionMeta: null,
      orders: [],
      checkoutRequested: false,
      checkoutRequestedAt: null,
    };
  }
  return model.detail;
}

export async function fetchKitchenBoard(admin: SupabaseClient, restaurantId: string) {
  const [{ data: orderRows }, { data: sessions }, { data: tableRows }] = await Promise.all([
    admin
      .from('orders')
      .select('id, table_id, display_name, status, created_at, updated_at, items, session_id')
      .eq('restaurant_id', restaurantId)
      .in('status', ['pending', 'cooking'])
      .order('created_at', { ascending: true }),
    admin
      .from('table_sessions')
      .select('id, table_id')
      .eq('restaurant_id', restaurantId)
      .in('status', ['open', 'billing']),
    admin
      .from('restaurant_tables')
      .select('id, display_name, sort_order')
      .eq('restaurant_id', restaurantId)
      .is('deleted_at', null),
  ]);

  const activeIds = new Set((sessions || []).map((s) => s.id as string));
  const orders = ((orderRows || []) as Array<{
    id: string;
    table_id: string;
    display_name: string;
    status: string;
    created_at: string;
    updated_at: string;
    items?: Order['items'] | null;
    session_id?: string | null;
  }>)
    .filter((o) => !o.session_id || activeIds.has(o.session_id))
    .map((o) => toKitchenBoardOrder(o))
    .filter((o): o is NonNullable<typeof o> => o != null);

  const tables = ((tableRows || []) as Array<{
    id: string;
    display_name: string;
    sort_order: number;
  }>).map(toKitchenBoardTable);

  const tableById = new Map(tables.map((t) => [t.id, t]));
  const activeTableIds = Array.from(
    new Set(
      (sessions || [])
        .map((s) => s.table_id as string)
        .filter(Boolean),
    ),
  ).sort((a, b) => {
    const ta = tableById.get(a);
    const tb = tableById.get(b);
    if (ta && tb) return compareRestaurantTables(ta, tb);
    return a.localeCompare(b);
  });

  return { orders, activeTableIds, tableById, tables };
}

export async function fetchWaiterBoard(admin: SupabaseClient, restaurantId: string) {
  const [
    { data: sessions },
    { data: rows },
    checkoutRequested,
    { data: tableRows },
    { data: groupRows },
    { data: memberRows },
    { data: buffetRows },
    partyLoaded,
  ] = await Promise.all([
    admin
      .from('table_sessions')
      .select('id, table_id, opened_at, status, opened_by_user_id')
      .eq('restaurant_id', restaurantId)
      .in('status', ['open', 'billing']),
    admin
      .from('orders')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .in('status', ['pending', 'cooking', 'done'])
      .order('updated_at', { ascending: false })
      .limit(200),
    fetchCheckoutRequestedBoard(admin, restaurantId),
    admin
      .from('restaurant_tables')
      .select('id, display_name, sort_order, seat_min, seat_max')
      .eq('restaurant_id', restaurantId)
      .is('deleted_at', null),
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
    admin
      .from('buffets')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('name'),
    loadTablePartyGroups(admin, restaurantId),
  ]);

  const orders = filterOrdersInActiveSessions((rows || []) as Order[], sessions || []);
  const sessionMetaByTableId = await buildActiveSessionMetaByTableId(
    admin,
    restaurantId,
    sessions || [],
  );
  const tables = (tableRows || []) as RestaurantTableRow[];
  const buffets = (buffetRows || []) as Buffet[];
  const restaurantHasActiveBuffets = buffets.some((b) => b.is_active);
  const openTableDefaults = restaurantHasActiveBuffets
    ? {
        buffets,
        buffetPricesByBuffetId: await resolveOpenTableBuffetPrices(
          admin,
          restaurantId,
          buffets,
          false,
        ),
      }
    : null;

  return {
    sessionMetaByTableId,
    checkoutRequestedTableIds: checkoutRequested.tableIds,
    checkoutRequestedAtByTableId: checkoutRequested.atByTableId,
    tables,
    groups: sortTableGroups((groupRows || []) as RestaurantTableGroup[]),
    members: (memberRows || []) as RestaurantTableGroupMember[],
    parties: partyLoaded.parties,
    partyMembers: partyLoaded.partyMembers,
    tableSummaries: buildWaiterBoardTableSummaries(tables, orders, sessionMetaByTableId),
    restaurantHasActiveBuffets,
    openTableDefaults,
  };
}

export async function fetchWaiterTableActionTargets(
  admin: SupabaseClient,
  restaurantId: string,
  sourceTableId: string,
  operation: 'transfer' | 'merge',
): Promise<RestaurantTableRow[]> {
  const [{ data: sessions }, { data: tableRows }, checkoutRequested, partyLoaded] =
    await Promise.all([
      admin
        .from('table_sessions')
        .select('id, table_id, opened_at, status, opened_by_user_id')
        .eq('restaurant_id', restaurantId)
        .in('status', ['open', 'billing']),
      admin
        .from('restaurant_tables')
        .select('id, display_name, sort_order, seat_min, seat_max')
        .eq('restaurant_id', restaurantId)
        .is('deleted_at', null),
      fetchCheckoutRequestedBoard(admin, restaurantId),
      loadTablePartyGroups(admin, restaurantId),
    ]);

  const tables = sortRestaurantTables((tableRows || []) as RestaurantTableRow[]);
  const sessionMetaByTableId = await buildActiveSessionMetaByTableId(
    admin,
    restaurantId,
    sessions || [],
  );
  return filterWaiterTableActionTargets(
    tables,
    sourceTableId,
    operation,
    sessionMetaByTableId,
    checkoutRequested.tableIds,
    tablePartyMemberTableIds(partyLoaded.partyMembers),
  );
}

/** SSR initial waiter board — deduped per request via React.cache. */
export const loadWaiterBoardInitial = cache(async (restaurantId: string) => {
  const admin = createAdminClient();
  return fetchWaiterBoard(admin, restaurantId);
});

/** SSR initial kitchen board — deduped per request via React.cache. */
export const loadKitchenBoardInitial = cache(async (restaurantId: string) => {
  const admin = createAdminClient();
  return fetchKitchenBoard(admin, restaurantId);
});
