import type { SupabaseClient } from '@supabase/supabase-js';
import { unstable_noStore as noStore } from 'next/cache';
import { isRestaurantSuspended } from '@mesa/shared';
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
  feature_flags?: Record<string, boolean> | null;
};

export type CustomerResolvedTableContext = {
  tableId: string;
  displayName: string;
  activeSession: TableSession | null;
};

export type CustomerRestaurantGateResult =
  | { kind: 'found'; restaurant: CustomerRestaurantRow }
  | { kind: 'not_found' }
  | { kind: 'suspended'; name: string; reason: string | null };

export async function loadCustomerRestaurantGate(
  admin: AdminClient,
  slug: string,
): Promise<CustomerRestaurantGateResult> {
  noStore();

  const { data } = await admin
    .from('restaurants')
    .select(
      'id, name, slug, logo_url, geo_latitude, geo_longitude, order_radius_meters, feature_flags, suspended_at, suspension_reason',
    )
    .eq('slug', slug)
    .maybeSingle();

  if (!data) return { kind: 'not_found' };
  if (isRestaurantSuspended(data.suspended_at as string | null)) {
    return {
      kind: 'suspended',
      name: data.name as string,
      reason: (data.suspension_reason as string | null) ?? null,
    };
  }

  return {
    kind: 'found',
    restaurant: {
      id: data.id as string,
      name: data.name as string,
      slug: data.slug as string,
      logo_url: data.logo_url as string | null | undefined,
      geo_latitude: data.geo_latitude as number | null | undefined,
      geo_longitude: data.geo_longitude as number | null | undefined,
      order_radius_meters: data.order_radius_meters as number | null | undefined,
      feature_flags: data.feature_flags as Record<string, boolean> | null | undefined,
    },
  };
}

/** API helper: 404 when missing, 403 when suspended. */
export async function loadCustomerRestaurantForApi(
  admin: AdminClient,
  slug: string,
): Promise<
  | { ok: true; restaurant: CustomerRestaurantRow }
  | { ok: false; status: number; error: string }
> {
  const gate = await loadCustomerRestaurantGate(admin, slug);
  if (gate.kind === 'not_found') {
    return { ok: false, status: 404, error: 'restaurant_not_found' };
  }
  if (gate.kind === 'suspended') {
    return { ok: false, status: 403, error: 'restaurant_suspended' };
  }
  return { ok: true, restaurant: gate.restaurant };
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

  const tableId = requestedTableId;
  const displayName = requestedTable.display_name;

  const { data: activeSession } = await admin
    .from('table_sessions')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('table_id', requestedTableId)
    .in('status', ['open', 'billing'])
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle();

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
