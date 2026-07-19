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
import {
  buildActiveSessionMetaByTableId,
  type WaiterTableSessionRow,
} from '@/lib/waiter-table-session-meta';
import {
  filterWaiterTableActionTargets,
} from '@/lib/waiter-table-occupancy';
import {
  buildWaiterBoardTableSummaries,
  type WaiterBoardTableSummary,
} from '@/lib/waiter-board-snapshot';
import { loadWaiterTablePageModel, resolveOpenTableBuffetPrices } from '@/lib/waiter-table-detail-load';
import type { WaiterBoardOpenTableDefaults } from '@/lib/waiter-board-open-table';
import { loadTablePartyGroups } from '@/lib/table-party-groups-server';
import {
  tablePartyMemberTableIds,
  type TablePartyGroup,
  type TablePartyGroupMember,
} from '@/lib/table-party-groups';
import type { Buffet } from '@/types';
import type { WaiterBoardLivePatch } from '@/lib/waiter-board-live';

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

async function loadWaiterBoardLiveInputs(admin: SupabaseClient, restaurantId: string) {
  const [{ data: sessions }, { data: rows }, checkoutRequested, partyLoaded, { data: tableRows }] =
    await Promise.all([
      admin
        .from('table_sessions')
        .select('id, table_id, opened_at, status, opened_by_user_id')
        .eq('restaurant_id', restaurantId)
        .in('status', ['open', 'billing']),
      admin
        .from('orders')
        // Board cards only need summary fields (+ items jsonb for totals/headcount).
        .select(
          'id, restaurant_id, session_id, table_id, display_name, status, items, total_amount, created_at, updated_at',
        )
        .eq('restaurant_id', restaurantId)
        .in('status', ['pending', 'cooking', 'done'])
        .order('updated_at', { ascending: false })
        .limit(200),
      fetchCheckoutRequestedBoard(admin, restaurantId),
      loadTablePartyGroups(admin, restaurantId),
      // Tables needed to build summaries; client keeps floor static from last full.
      admin
        .from('restaurant_tables')
        .select('id, display_name, sort_order, seat_min, seat_max')
        .eq('restaurant_id', restaurantId)
        .is('deleted_at', null),
    ]);

  const sessionRows = (sessions || []) as WaiterTableSessionRow[];
  const orders = filterOrdersInActiveSessions((rows || []) as Order[], sessionRows);
  const sessionMetaByTableId = await buildActiveSessionMetaByTableId(
    admin,
    restaurantId,
    sessionRows,
  );
  const tables = (tableRows || []) as RestaurantTableRow[];

  return {
    sessionMetaByTableId,
    checkoutRequestedTableIds: checkoutRequested.tableIds,
    checkoutRequestedAtByTableId: checkoutRequested.atByTableId,
    parties: partyLoaded.parties,
    partyMembers: partyLoaded.partyMembers,
    tableSummaries: buildWaiterBoardTableSummaries(tables, orders, sessionMetaByTableId),
    tables,
  };
}

/** Doorbell / live refresh — occupancy slice only (no groups/buffet defaults). */
export async function fetchWaiterBoardLive(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<WaiterBoardLivePatch> {
  const live = await loadWaiterBoardLiveInputs(admin, restaurantId);
  return {
    sessionMetaByTableId: live.sessionMetaByTableId,
    checkoutRequestedTableIds: live.checkoutRequestedTableIds,
    checkoutRequestedAtByTableId: live.checkoutRequestedAtByTableId,
    parties: live.parties,
    partyMembers: live.partyMembers,
    tableSummaries: live.tableSummaries,
  };
}

export async function fetchWaiterTablePageModel(
  admin: SupabaseClient,
  restaurantId: string,
  tableId: string,
) {
  return loadWaiterTablePageModel(admin, restaurantId, tableId);
}

export async function fetchKitchenBoard(admin: SupabaseClient, restaurantId: string) {
  const [{ data: orderRows }, { data: sessions }, { data: tableRows }] = await Promise.all([
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
  ]);

  const activeIds = new Set((sessions || []).map((s) => s.id as string));
  const orders = ((orderRows || []) as Order[]).filter(
    (o) => !o.session_id || activeIds.has(o.session_id as string),
  );
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

  return { orders, activeTableIds, tableById, tables: (tableRows || []) as RestaurantTableRow[] };
}

/** Full board — floor static + live occupancy (SSR, resume, mutation, list re-entry). */
export async function fetchWaiterBoard(admin: SupabaseClient, restaurantId: string) {
  const [live, { data: groupRows }, { data: memberRows }, { data: buffetRows }] = await Promise.all([
    loadWaiterBoardLiveInputs(admin, restaurantId),
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
    sessionMetaByTableId: live.sessionMetaByTableId,
    checkoutRequestedTableIds: live.checkoutRequestedTableIds,
    checkoutRequestedAtByTableId: live.checkoutRequestedAtByTableId,
    tables: live.tables,
    groups: sortTableGroups((groupRows || []) as RestaurantTableGroup[]),
    members: (memberRows || []) as RestaurantTableGroupMember[],
    parties: live.parties,
    partyMembers: live.partyMembers,
    tableSummaries: live.tableSummaries,
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
