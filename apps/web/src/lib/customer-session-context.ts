import type { SupabaseClient } from '@supabase/supabase-js';
import { unstable_noStore as noStore } from 'next/cache';
import { isRestaurantSuspended } from '@mesa/shared';
import type { SessionCollectedPayment } from '@/lib/checkout-session-payments';
import type { BillSplit, Order, TableSession } from '@/types';
import { filterOrdersForCustomerDisplay } from '@/lib/customer-orders-display';
import { parseTableIdParam, tableIdsEqual } from '@/lib/restaurant-tables';
import type {
  WaiterTableDetailData,
  WaiterTablePageModel,
} from '@/lib/waiter-table-detail-types';

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
  order_cooldown_seconds?: number | null;
};

export type CustomerResolvedTableContext = {
  tableId: string;
  displayName: string;
  activeSession: TableSession | null;
};

/** Same shape as GET /api/restaurants/[slug]/customer/session and menu SSR props. */
export type CustomerSessionContext = {
  table_id: string;
  display_name: string;
  active_session: TableSession | null;
  recent_orders: Order[];
};

export type CustomerBillCollectedPayment = SessionCollectedPayment;

export type CustomerBillContext = {
  table_id: string;
  display_name: string;
  active_session: TableSession | null;
  orders: Order[];
  existing_split: BillSplit | null;
  collected_payments: CustomerBillCollectedPayment[];
  /** Together-group size for this table (0 = not in a party). */
  party_member_count: number;
};

/**
 * Session read scope (one CustomerSessionContext shape):
 * - gate: table + thin active session; recent_orders always []
 * - full: gate fields + recent orders for footer / ordered drawer
 */
export type CustomerSessionScope = 'gate' | 'full';

export function parseCustomerSessionScope(
  value: string | null | undefined,
): CustomerSessionScope {
  return value === 'gate' ? 'gate' : 'full';
}

/**
 * Bill read scope (one CustomerBillContext shape):
 * - live: active session + full bill orders + party size for client refresh / pre-submit checks
 * - full: live fields + existing split + collected payments for bill page boot
 */
export type CustomerBillScope = 'live' | 'full';

export function parseCustomerBillScope(value: string | null | undefined): CustomerBillScope {
  return value === 'live' ? 'live' : 'full';
}

/**
 * Apply a scoped session response onto prior client state.
 * Gate must not wipe same-session orders; session id change / close clears them.
 */
export function applyCustomerSessionScopeMerge(
  previous: CustomerSessionContext | null,
  incoming: CustomerSessionContext,
  scope: CustomerSessionScope,
): CustomerSessionContext {
  if (scope === 'full') return incoming;

  const prevSessionId = previous?.active_session?.id ?? null;
  const nextSessionId = incoming.active_session?.id ?? null;
  if (!nextSessionId || nextSessionId !== prevSessionId) {
    return { ...incoming, recent_orders: [] };
  }
  return {
    ...incoming,
    recent_orders: previous?.recent_orders ?? [],
  };
}

/** Columns needed for guest ordering gate + menu session identity. */
const CUSTOMER_SESSION_SELECT =
  'id, restaurant_id, table_id, status, opened_at';

/** Columns needed for menu footer / ordered drawer (billable lines + display). */
const CUSTOMER_SESSION_ORDER_SELECT =
  'id, restaurant_id, session_id, table_id, display_name, status, items, total_amount, created_at, updated_at';

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
      'id, name, slug, logo_url, geo_latitude, geo_longitude, order_radius_meters, feature_flags, order_cooldown_seconds, suspended_at, suspension_reason',
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
      order_cooldown_seconds: data.order_cooldown_seconds as number | null | undefined,
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

const CUSTOMER_TABLE_SELECT =
  'id, restaurant_id, display_name, sort_order, deleted_at, created_at';

export type CustomerTableIdRequest =
  | { kind: 'by_id'; tableId: string }
  | { kind: 'default' }
  | { kind: 'invalid' };

/** How to resolve table_id from menu/bill query params (testable, no I/O). */
export function resolveCustomerTableIdRequest(
  tableIdParam?: string | null,
): CustomerTableIdRequest {
  const rawTableId = tableIdParam?.trim() || '';
  const parsedTableId = rawTableId ? parseTableIdParam(rawTableId) : null;
  if (rawTableId && !parsedTableId) return { kind: 'invalid' };
  if (parsedTableId) return { kind: 'by_id', tableId: parsedTableId };
  return { kind: 'default' };
}

async function loadCustomerTableRow(
  admin: AdminClient,
  restaurantId: string,
  request: CustomerTableIdRequest,
): Promise<{ id: string; display_name: string } | null> {
  if (request.kind === 'invalid') return null;

  let query = admin
    .from('restaurant_tables')
    .select(CUSTOMER_TABLE_SELECT)
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null);

  if (request.kind === 'by_id') {
    query = query.eq('id', request.tableId);
  } else {
    query = query.order('sort_order').limit(1);
  }

  const { data } = await query.maybeSingle();
  return data ? { id: data.id as string, display_name: data.display_name as string } : null;
}

export async function resolveCustomerTableContext(params: {
  admin: AdminClient;
  restaurantId: string;
  tableIdParam?: string | null;
}): Promise<CustomerResolvedTableContext | null> {
  const { admin, restaurantId, tableIdParam } = params;
  const tableRequest = resolveCustomerTableIdRequest(tableIdParam);
  const requestedTable = await loadCustomerTableRow(admin, restaurantId, tableRequest);
  if (!requestedTable) return null;

  const { data: activeSession } = await admin
    .from('table_sessions')
    .select(CUSTOMER_SESSION_SELECT)
    .eq('restaurant_id', restaurantId)
    .eq('table_id', requestedTable.id)
    .in('status', ['open', 'billing'])
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    tableId: requestedTable.id,
    displayName: requestedTable.display_name,
    activeSession: (activeSession as TableSession | null) || null,
  };
}

/** Map staff table detail slice to customer menu session shape (client boot bridge). */
export function customerSessionContextFromWaiterDetail(
  tableId: string,
  detail: Pick<WaiterTableDetailData, 'table' | 'sessionMeta' | 'orders'>,
): CustomerSessionContext | null {
  const table = detail.table;
  if (!table || !tableIdsEqual(table.id, tableId)) return null;

  const sessionMeta = detail.sessionMeta;
  const restaurantId = detail.orders[0]?.restaurant_id ?? '';
  const active_session: TableSession | null = sessionMeta
    ? {
        id: sessionMeta.sessionId,
        restaurant_id: restaurantId,
        table_id: table.id,
        status: sessionMeta.status,
        opened_at: sessionMeta.openedAt,
      }
    : null;

  return {
    table_id: table.id,
    display_name: table.display_name,
    active_session,
    recent_orders: active_session ? detail.orders : [],
  };
}

/**
 * Menu entry boot: published staff mutation cache wins over SSR/Router cache when it
 * carries an active session (same contract as waiter table detail initialModel).
 */
export function resolveCustomerSessionBootContext(params: {
  tableId: string;
  ssrContext: CustomerSessionContext | null;
  publishedModel?: WaiterTablePageModel | null;
}): CustomerSessionContext | null {
  const fromPublished = params.publishedModel
    ? customerSessionContextFromWaiterDetail(params.tableId, params.publishedModel.detail)
    : null;
  if (fromPublished?.active_session) return fromPublished;
  return params.ssrContext;
}

export async function loadCustomerSessionContext(params: {
  admin: AdminClient;
  restaurantId: string;
  tableIdParam?: string | null;
  /** Default full — menu SSR and legacy callers keep orders. */
  scope?: CustomerSessionScope;
}): Promise<CustomerSessionContext | null> {
  const scope = params.scope ?? 'full';
  const tableContext = await resolveCustomerTableContext(params);
  if (!tableContext) return null;

  const recent_orders =
    scope === 'full' && tableContext.activeSession?.id
      ? await loadCustomerSessionOrders({
          admin: params.admin,
          restaurantId: params.restaurantId,
          sessionId: tableContext.activeSession.id,
          ascending: false,
          limit: 20,
        })
      : [];

  return {
    table_id: tableContext.tableId,
    display_name: tableContext.displayName,
    active_session: tableContext.activeSession,
    recent_orders,
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
    .select(CUSTOMER_SESSION_ORDER_SELECT)
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
