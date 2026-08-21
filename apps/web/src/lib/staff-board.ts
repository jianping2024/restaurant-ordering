import { cache } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Order, Buffet } from '@/types';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  sortTableGroups,
  type RestaurantTableGroup,
  type RestaurantTableGroupMember,
} from '@/lib/restaurant-table-groups';
import { compareRestaurantTables, sortRestaurantTables, type RestaurantTableRow } from '@/lib/restaurant-tables';
import { fetchCheckoutRequestedBoard } from '@/lib/table-checkout-pending';
import type { WaiterTableSessionMeta } from '@/lib/waiter-board-session';
import { loadOrdersForActiveWaiterBoardSessions } from '@/lib/waiter-board-active-orders';
import {
  buildActiveSessionMetaByTableId,
  type WaiterTableSessionRow,
} from '@/lib/waiter-table-session-meta';
import {
  filterWaiterTableActionTargets,
} from '@/lib/waiter-table-occupancy';
import {
  buildWaiterBoardTableSummaries,
  stubFloorTablesForLiveOccupancy,
  type WaiterBoardTableSummary,
} from '@/lib/waiter-board-snapshot';
import {
  loadWaiterTablePageModel,
  resolveOpenTableBuffetPrices,
} from '@/lib/waiter-table-detail-load';
import type { WaiterBoardOpenTableDefaults } from '@/lib/waiter-board-open-table';
import { loadTablePartyGroups } from '@/lib/table-party-groups-server';
import {
  tablePartyMemberTableIds,
  type TablePartyGroup,
  type TablePartyGroupMember,
} from '@/lib/table-party-groups';
import type { WaiterBoardLivePatch } from '@/lib/waiter-board-live';
import { attachBoardSessionRelations } from '@/lib/waiter-board-session-relation';
import { enrichKitchenOrdersWithStations } from '@/lib/kitchen-order-station-enrich';
import { kitchenReadyAfterMinutesFromConfig } from '@/lib/print-agent-config';

export { enrichKitchenOrdersWithStations } from '@/lib/kitchen-order-station-enrich';

export type { WaiterTableDetailData } from '@/lib/waiter-table-detail-types';
export type { WaiterTablePageModel } from '@/lib/waiter-table-detail-types';
export type { WaiterBoardOpenTableDefaults } from '@/lib/waiter-board-open-table';
export type { WaiterBoardLivePatch } from '@/lib/waiter-board-live';

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

type WaiterBoardOccupancyCore = {
  sessionRows: WaiterTableSessionRow[];
  orders: Order[];
  sessionMetaByTableId: Record<string, WaiterTableSessionMeta>;
  checkoutRequestedTableIds: string[];
  checkoutRequestedAtByTableId: Record<string, string>;
  parties: TablePartyGroup[];
  partyMembers: TablePartyGroupMember[];
};

/** Shared occupancy reads for full + live (sessions, checkout, parties, orders). */
async function loadWaiterBoardOccupancyCore(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<WaiterBoardOccupancyCore> {
  const [{ data: sessions }, checkoutRequested, partyLoaded] = await Promise.all([
    admin
      .from('table_sessions')
      .select('id, table_id, opened_at, status, opened_by_user_id, opened_by_name')
      .eq('restaurant_id', restaurantId)
      .in('status', ['open', 'billing']),
    fetchCheckoutRequestedBoard(admin, restaurantId),
    loadTablePartyGroups(admin, restaurantId),
  ]);

  const sessionRows = (sessions || []) as WaiterTableSessionRow[];
  const orders = await loadOrdersForActiveWaiterBoardSessions(admin, restaurantId, sessionRows);
  let sessionMetaByTableId = buildActiveSessionMetaByTableId(sessionRows);
  sessionMetaByTableId = await attachBoardSessionRelations(
    admin,
    restaurantId,
    sessionMetaByTableId,
  );

  return {
    sessionRows,
    orders,
    sessionMetaByTableId,
    checkoutRequestedTableIds: checkoutRequested.tableIds,
    checkoutRequestedAtByTableId: checkoutRequested.atByTableId,
    parties: partyLoaded.parties,
    partyMembers: partyLoaded.partyMembers,
  };
}

/** Doorbell / live — no floor tables query; opener from stamped opened_by_name. */
export async function fetchWaiterBoardLive(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<WaiterBoardLivePatch> {
  const occupancy = await loadWaiterBoardOccupancyCore(admin, restaurantId);
  const stubTables = stubFloorTablesForLiveOccupancy(
    occupancy.sessionMetaByTableId,
    occupancy.orders,
  );
  return {
    sessionMetaByTableId: occupancy.sessionMetaByTableId,
    checkoutRequestedTableIds: occupancy.checkoutRequestedTableIds,
    checkoutRequestedAtByTableId: occupancy.checkoutRequestedAtByTableId,
    parties: occupancy.parties,
    partyMembers: occupancy.partyMembers,
    tableSummaries: buildWaiterBoardTableSummaries(
      stubTables,
      occupancy.orders,
      occupancy.sessionMetaByTableId,
    ),
  };
}

export async function fetchWaiterTablePageModel(
  admin: SupabaseClient,
  restaurantId: string,
  tableId: string,
  options: { includeOpenTableDefaults?: boolean } = {},
) {
  return loadWaiterTablePageModel(admin, restaurantId, tableId, options);
}

export type KitchenBoardData = {
  orders: Order[];
  activeTableIds: string[];
  tableById: Map<string, RestaurantTableRow>;
  tables: RestaurantTableRow[];
  kitchen_ready_after_minutes: number;
};

export async function fetchKitchenBoard(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<KitchenBoardData> {
  const [{ data: orderRows }, { data: sessions }, { data: tableRows }, { data: restaurant }] =
    await Promise.all([
      admin
        .from('orders')
        .select('*')
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
        .select('id, display_name, sort_order, seat_min, seat_max')
        .eq('restaurant_id', restaurantId)
        .is('deleted_at', null),
      admin
        .from('restaurants')
        .select('print_agent_config')
        .eq('id', restaurantId)
        .maybeSingle(),
    ]);

  const activeIds = new Set((sessions || []).map((s) => s.id as string));
  const rawOrders = ((orderRows || []) as Order[]).filter(
    (o) => !o.session_id || activeIds.has(o.session_id as string),
  );
  const orders = await enrichKitchenOrdersWithStations(admin, restaurantId, rawOrders);
  const tableById = new Map((tableRows || []).map((t) => [t.id as string, t as RestaurantTableRow]));
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

  return {
    orders,
    activeTableIds,
    tableById,
    tables: (tableRows || []) as RestaurantTableRow[],
    kitchen_ready_after_minutes: kitchenReadyAfterMinutesFromConfig(
      restaurant?.print_agent_config,
    ),
  };
}

/** Full board — floor static + live occupancy (SSR, resume, mutation, list re-entry). */
export async function fetchWaiterBoard(admin: SupabaseClient, restaurantId: string) {
  const [occupancy, { data: tableRows }, { data: groupRows }, { data: memberRows }, { data: buffetRows }] =
    await Promise.all([
      loadWaiterBoardOccupancyCore(admin, restaurantId),
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
        .select('id, restaurant_id, name, is_active, description, created_at, updated_at')
        .eq('restaurant_id', restaurantId)
        .order('name'),
    ]);

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
    sessionMetaByTableId: occupancy.sessionMetaByTableId,
    checkoutRequestedTableIds: occupancy.checkoutRequestedTableIds,
    checkoutRequestedAtByTableId: occupancy.checkoutRequestedAtByTableId,
    tables,
    groups: sortTableGroups((groupRows || []) as RestaurantTableGroup[]),
    members: (memberRows || []) as RestaurantTableGroupMember[],
    parties: occupancy.parties,
    partyMembers: occupancy.partyMembers,
    tableSummaries: buildWaiterBoardTableSummaries(
      tables,
      occupancy.orders,
      occupancy.sessionMetaByTableId,
    ),
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
        .select('id, table_id, opened_at, status, opened_by_user_id, opened_by_name')
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
  const sessionMetaByTableId = buildActiveSessionMetaByTableId(
    (sessions || []) as WaiterTableSessionRow[],
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

/** SSR initial kitchen board — deduped per request via React.cache. */
export const loadKitchenBoardInitial = cache(async (restaurantId: string) => {
  const admin = createAdminClient();
  return fetchKitchenBoard(admin, restaurantId);
});
