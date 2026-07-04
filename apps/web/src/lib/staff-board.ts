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
  ACTIVE_ORDER_STATUSES,
  filterOrdersInActiveSessions,
  sessionMetaByTableIdFromSessions,
} from '@/lib/waiter-board-query';
import {
  activeWaiterTableIds,
  filterWaiterTableActionTargets,
} from '@/lib/waiter-table-occupancy';

export type WaiterTableDetailData = {
  table: RestaurantTableRow | null;
  sessionMeta: WaiterTableSessionMeta | null;
  orders: Order[];
  checkoutRequested: boolean;
  checkoutRequestedAt: string | null;
};

async function fetchCheckoutRequestedForTable(
  client: SupabaseClient,
  restaurantId: string,
  tableId: string,
): Promise<{ requested: boolean; at: string | null }> {
  const { data } = await client
    .from('bill_splits')
    .select('created_at')
    .eq('restaurant_id', restaurantId)
    .eq('table_id', tableId)
    .eq('status', 'requested')
    .not('session_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.created_at) return { requested: false, at: null };
  return { requested: true, at: data.created_at as string };
}

async function loadTableOrdersForSession(
  admin: SupabaseClient,
  restaurantId: string,
  tableId: string,
  sessionId: string | null,
): Promise<Order[]> {
  // Contract: table detail consumers treat this list as authoritative for the detail view.
  // The waiter board uses the full-restaurant order list + ordersForWaiterTableView per table.
  if (sessionId) {
    const { data } = await admin
      .from('orders')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('session_id', sessionId)
      .in('status', [...ACTIVE_ORDER_STATUSES])
      .order('updated_at', { ascending: false });
    return (data || []) as Order[];
  }

  const { data } = await admin
    .from('orders')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('table_id', tableId)
    .is('session_id', null)
    .in('status', [...ACTIVE_ORDER_STATUSES])
    .order('updated_at', { ascending: false });
  return (data || []) as Order[];
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
      .select('id, display_name, sort_order')
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

export async function fetchWaiterBoard(admin: SupabaseClient, restaurantId: string) {
  const [
    { data: sessions },
    { data: rows },
    checkoutRequested,
    { data: tableRows },
    { data: groupRows },
    { data: memberRows },
  ] = await Promise.all([
    admin
      .from('table_sessions')
      .select('id, table_id, opened_at, status')
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
      .select('id, display_name, sort_order')
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
  ]);

  const orders = filterOrdersInActiveSessions((rows || []) as Order[], sessions || []);
  const sessionMetaByTableId = sessionMetaByTableIdFromSessions(sessions || []);
  return {
    orders,
    sessionMetaByTableId,
    checkoutRequestedTableIds: checkoutRequested.tableIds,
    checkoutRequestedAtByTableId: checkoutRequested.atByTableId,
    tables: (tableRows || []) as RestaurantTableRow[],
    groups: sortTableGroups((groupRows || []) as RestaurantTableGroup[]),
    members: (memberRows || []) as RestaurantTableGroupMember[],
  };
}

export async function fetchWaiterTableDetail(
  admin: SupabaseClient,
  restaurantId: string,
  tableId: string,
): Promise<WaiterTableDetailData> {
  const [{ data: tableRow }, { data: sessionRow }, checkout] = await Promise.all([
    admin
      .from('restaurant_tables')
      .select('id, display_name, sort_order')
      .eq('restaurant_id', restaurantId)
      .eq('id', tableId)
      .is('deleted_at', null)
      .maybeSingle(),
    admin
      .from('table_sessions')
      .select('id, table_id, opened_at, status')
      .eq('restaurant_id', restaurantId)
      .eq('table_id', tableId)
      .in('status', ['open', 'billing'])
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    fetchCheckoutRequestedForTable(admin, restaurantId, tableId),
  ]);

  const sessionMeta =
    sessionRow?.id &&
    sessionRow.opened_at &&
    (sessionRow.status === 'open' || sessionRow.status === 'billing')
      ? {
          sessionId: sessionRow.id as string,
          openedAt: sessionRow.opened_at as string,
          status: sessionRow.status as 'open' | 'billing',
        }
      : null;

  const orders = await loadTableOrdersForSession(
    admin,
    restaurantId,
    tableId,
    sessionMeta?.sessionId ?? null,
  );

  return {
    table: tableRow ? (tableRow as RestaurantTableRow) : null,
    sessionMeta,
    orders,
    checkoutRequested: checkout.requested,
    checkoutRequestedAt: checkout.at,
  };
}

export async function fetchWaiterTableActionTargets(
  admin: SupabaseClient,
  restaurantId: string,
  sourceTableId: string,
  operation: 'transfer' | 'merge',
): Promise<RestaurantTableRow[]> {
  const [{ data: sessions }, { data: tableRows }, { data: orderRows }, checkoutRequested] =
    await Promise.all([
    admin
      .from('table_sessions')
      .select('id, table_id, opened_at, status')
      .eq('restaurant_id', restaurantId)
      .in('status', ['open', 'billing']),
    admin
      .from('restaurant_tables')
      .select('id, display_name, sort_order')
      .eq('restaurant_id', restaurantId)
      .is('deleted_at', null),
    admin
      .from('orders')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .in('status', [...ACTIVE_ORDER_STATUSES])
      .order('updated_at', { ascending: false }),
    fetchCheckoutRequestedBoard(admin, restaurantId),
  ]);

  const tables = sortRestaurantTables((tableRows || []) as RestaurantTableRow[]);
  const sessionMetaByTableId = sessionMetaByTableIdFromSessions(sessions || []);
  const orders = filterOrdersInActiveSessions((orderRows || []) as Order[], sessions || []);
  const activeIds = activeWaiterTableIds(tables, orders, sessionMetaByTableId);
  return filterWaiterTableActionTargets(
    tables,
    activeIds,
    sourceTableId,
    operation,
    sessionMetaByTableId,
    checkoutRequested.tableIds,
  );
}

/** SSR initial waiter board — deduped per request via React.cache. */
export const loadWaiterBoardInitial = cache(async (restaurantId: string) => {
  const admin = createAdminClient();
  return fetchWaiterBoard(admin, restaurantId);
});

/** SSR initial waiter table detail — same query path as the staff table-detail API. */
export const loadWaiterTableDetailInitial = cache(
  async (restaurantId: string, tableId: string) => {
    const admin = createAdminClient();
    return fetchWaiterTableDetail(admin, restaurantId, tableId);
  },
);
