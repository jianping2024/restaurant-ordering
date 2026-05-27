import type { SupabaseClient } from '@supabase/supabase-js';
import type { BillSplit, Order, TableSession } from '@/types';
import { filterOrdersForCustomerDisplay } from '@/lib/customer-orders-display';
import { parseTableIdParam, type RestaurantTableRow } from '@/lib/restaurant-tables';

type AdminClient = SupabaseClient;

export type CustomerRestaurantRow = {
  id: string;
  name: string;
  slug: string;
  logo_url?: string | null;
  geo_latitude?: number | null;
  geo_longitude?: number | null;
  order_radius_meters?: number | null;
};

export type CustomerResolvedTableContext = {
  tableId: string;
  displayName: string;
  activeSession: TableSession | null;
};

export async function loadCustomerRestaurant(
  admin: AdminClient,
  slug: string,
): Promise<CustomerRestaurantRow | null> {
  const { data } = await admin
    .from('restaurants')
    .select('id, name, slug, logo_url, geo_latitude, geo_longitude, order_radius_meters')
    .eq('slug', slug)
    .maybeSingle();
  return (data as CustomerRestaurantRow | null) || null;
}

export async function resolveCustomerTableContext(params: {
  admin: AdminClient;
  restaurantId: string;
  tableIdParam?: string | null;
}): Promise<CustomerResolvedTableContext | null> {
  const { admin, restaurantId, tableIdParam } = params;

  const { data: activeTables } = await admin
    .from('restaurant_tables')
    .select('id, restaurant_id, display_name, sort_order, deleted_at, created_at')
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null)
    .order('sort_order');

  const tables = (activeTables || []) as RestaurantTableRow[];
  const defaultTableId = tables[0]?.id;
  const rawTableId = tableIdParam?.trim() || '';
  const parsedTableId = rawTableId ? parseTableIdParam(rawTableId) : null;
  if (rawTableId && !parsedTableId) return null;
  const requestedTableId = parsedTableId ?? defaultTableId;
  if (!requestedTableId) return null;

  const requestedTable = tables.find((t) => t.id === requestedTableId);
  if (!requestedTable) return null;

  let tableId = requestedTableId;
  let displayName = requestedTable.display_name;

  let { data: activeSession } = await admin
    .from('table_sessions')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('table_id', requestedTableId)
    .in('status', ['open', 'billing'])
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!activeSession) {
    const { data: mergedFromSession } = await admin
      .from('table_sessions')
      .select('merge_into_session_id')
      .eq('restaurant_id', restaurantId)
      .eq('table_id', requestedTableId)
      .eq('status', 'closed')
      .eq('closed_reason', 'merged')
      .not('merge_into_session_id', 'is', null)
      .order('closed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (mergedFromSession?.merge_into_session_id) {
      const { data: targetSession } = await admin
        .from('table_sessions')
        .select('*')
        .eq('id', mergedFromSession.merge_into_session_id)
        .in('status', ['open', 'billing'])
        .maybeSingle();

      if (targetSession?.table_id) {
        activeSession = targetSession;
        tableId = targetSession.table_id as string;
        displayName = tables.find((t) => t.id === tableId)?.display_name ?? displayName;
      }
    }
  }

  return {
    tableId,
    displayName,
    activeSession: (activeSession as TableSession | null) || null,
  };
}

export async function loadCustomerSessionOrders(params: {
  admin: AdminClient;
  restaurantId: string;
  sessionId: string;
  ascending?: boolean;
  limit?: number;
}): Promise<Order[]> {
  const { admin, restaurantId, sessionId, ascending = true, limit } = params;
  let query = admin
    .from('orders')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('session_id', sessionId)
    .order('created_at', { ascending });
  if (limit) query = query.limit(limit);
  const { data } = await query;
  return filterOrdersForCustomerDisplay((data || []) as Order[]);
}

export async function loadCustomerExistingSplit(params: {
  admin: AdminClient;
  sessionId: string;
}): Promise<BillSplit | null> {
  const { admin, sessionId } = params;
  const { data } = await admin
    .from('bill_splits')
    .select('*')
    .eq('session_id', sessionId)
    .in('status', ['requested', 'confirmed', 'pending'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as BillSplit | null) || null;
}
