import { cache } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Buffet, Order } from '@/types';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ResolvedBuffetPriceRow } from '@/lib/buffet-order';
import { resolveBuffetPricesServer } from '@/lib/resolve-buffet-prices-server';
import type { RestaurantTableRow } from '@/lib/restaurant-tables';
import type { WaiterTableSessionMeta } from '@/lib/waiter-board-session';
import { ACTIVE_ORDER_STATUSES } from '@/lib/waiter-board-query';
import { defaultActiveBuffet } from '@/lib/waiter-table-detail-view';
import {
  sessionMetaFromRow,
  type WaiterTableSessionRow,
} from '@/lib/waiter-table-session-meta';
import {
  snapshotToPageModel,
  type WaiterTableDetailSnapshot,
} from '@/lib/waiter-table-detail-snapshot';
import type { WaiterTableDetailData, WaiterTablePageModel } from '@/lib/waiter-table-detail-types';

export type { WaiterTableDetailSnapshot } from '@/lib/waiter-table-detail-snapshot';
export { snapshotToDetailData, snapshotToPageModel } from '@/lib/waiter-table-detail-snapshot';
export type { WaiterTableSessionRow } from '@/lib/waiter-table-session-meta';
export {
  sessionMetaFromEnsuredSession,
  sessionMetaFromRow,
  tableSessionRefFromRow,
} from '@/lib/waiter-table-session-meta';

function isCheckoutPending(
  sessionMeta: WaiterTableSessionMeta,
  checkoutRequested: boolean,
): boolean {
  return checkoutRequested || sessionMeta.status === 'billing';
}

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
  sessionId: string,
): Promise<Order[]> {
  const { data, error } = await admin
    .from('orders')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('session_id', sessionId)
    .in('status', [...ACTIVE_ORDER_STATUSES])
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []) as Order[];
}

async function loadTableAndSession(
  admin: SupabaseClient,
  restaurantId: string,
  tableId: string,
): Promise<{ table: RestaurantTableRow | null; sessionRow: WaiterTableSessionRow | null }> {
  const [{ data: tableRow }, { data: sessionRow }] = await Promise.all([
    admin
      .from('restaurant_tables')
      .select('id, display_name, sort_order, seat_min, seat_max')
      .eq('restaurant_id', restaurantId)
      .eq('id', tableId)
      .is('deleted_at', null)
      .maybeSingle(),
    admin
      .from('table_sessions')
      .select('id, table_id, opened_at, status, opened_by_user_id')
      .eq('restaurant_id', restaurantId)
      .eq('table_id', tableId)
      .in('status', ['open', 'billing'])
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    table: tableRow ? (tableRow as RestaurantTableRow) : null,
    sessionRow: (sessionRow as WaiterTableSessionRow | null) ?? null,
  };
}

async function loadActiveBuffets(admin: SupabaseClient, restaurantId: string): Promise<Buffet[]> {
  const { data } = await admin
    .from('buffets')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('name');
  return (data || []) as Buffet[];
}

/** Default active buffet only; skip when checkout pending (buffet panel hidden). */
export async function resolveOpenTableBuffetPrices(
  admin: SupabaseClient,
  restaurantId: string,
  buffets: Buffet[],
  skip: boolean,
  resolvedByBuffetId: Record<string, ResolvedBuffetPriceRow | null> = {},
): Promise<Record<string, ResolvedBuffetPriceRow | null>> {
  if (skip) return {};
  const buffet = defaultActiveBuffet(buffets);
  if (!buffet) return {};
  if (Object.prototype.hasOwnProperty.call(resolvedByBuffetId, buffet.id)) {
    return { [buffet.id]: resolvedByBuffetId[buffet.id] };
  }
  const resolved = await resolveBuffetPricesServer(admin, restaurantId, buffet.id);
  return { [buffet.id]: resolved };
}

export function buildActiveWaiterTableSnapshot(input: {
  table: RestaurantTableRow;
  buffets: Buffet[];
  sessionMeta: WaiterTableSessionMeta;
  orders: Order[];
  checkoutRequested: boolean;
  checkoutRequestedAt: string | null;
  buffetPricesByBuffetId: Record<string, ResolvedBuffetPriceRow | null>;
}): Extract<WaiterTableDetailSnapshot, { kind: 'active' }> {
  return { kind: 'active', ...input };
}

export function buildActiveWaiterTablePageModel(input: {
  table: RestaurantTableRow;
  buffets: Buffet[];
  sessionMeta: WaiterTableSessionMeta;
  orders: Order[];
  checkoutRequested: boolean;
  checkoutRequestedAt: string | null;
  buffetPricesByBuffetId: Record<string, ResolvedBuffetPriceRow | null>;
}): WaiterTablePageModel {
  return snapshotToPageModel(buildActiveWaiterTableSnapshot(input));
}

export {
  fetchCheckoutRequestedForTable,
  isCheckoutPending,
  loadActiveBuffets,
  loadTableAndSession,
  loadTableOrdersForSession,
};

/** Single server loader: idle (no session) vs active (open/billing session). */
export async function loadWaiterTableDetailSnapshot(
  admin: SupabaseClient,
  restaurantId: string,
  tableId: string,
): Promise<WaiterTableDetailSnapshot | null> {
  const [{ table, sessionRow }, buffets] = await Promise.all([
    loadTableAndSession(admin, restaurantId, tableId),
    loadActiveBuffets(admin, restaurantId),
  ]);

  if (!table) return null;

  const sessionMeta = sessionMetaFromRow(sessionRow);

  if (!sessionMeta) {
    const buffetPricesByBuffetId = await resolveOpenTableBuffetPrices(
      admin,
      restaurantId,
      buffets,
      false,
    );
    return { kind: 'idle', table, buffets, buffetPricesByBuffetId };
  }

  const checkout = await fetchCheckoutRequestedForTable(admin, restaurantId, tableId);
  const checkoutPending = isCheckoutPending(sessionMeta, checkout.requested);

  const [orders, buffetPricesByBuffetId] = await Promise.all([
    loadTableOrdersForSession(admin, restaurantId, sessionMeta.sessionId),
    resolveOpenTableBuffetPrices(admin, restaurantId, buffets, checkoutPending),
  ]);

  return buildActiveWaiterTableSnapshot({
    table,
    buffets,
    sessionMeta,
    orders,
    checkoutRequested: checkout.requested,
    checkoutRequestedAt: checkout.at,
    buffetPricesByBuffetId,
  });
}

export async function loadWaiterTablePageModel(
  admin: SupabaseClient,
  restaurantId: string,
  tableId: string,
): Promise<WaiterTablePageModel | null> {
  const snapshot = await loadWaiterTableDetailSnapshot(admin, restaurantId, tableId);
  if (!snapshot) return null;
  return snapshotToPageModel(snapshot);
}

/** SSR page seed — deduped per request via React.cache. */
export const loadWaiterTablePageInitial = cache(
  async (restaurantId: string, tableId: string): Promise<WaiterTablePageModel | null> => {
    const admin = createAdminClient();
    return loadWaiterTablePageModel(admin, restaurantId, tableId);
  },
);

export async function loadWaiterTableDetailData(
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
