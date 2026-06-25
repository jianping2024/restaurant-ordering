import type { SupabaseClient } from '@supabase/supabase-js';
import type { Order } from '@/types';
import { compareRestaurantTables, type RestaurantTableRow } from '@/lib/restaurant-tables';
import { fetchCheckoutRequestedBoard } from '@/lib/table-checkout-pending';
import type { WaiterTableSessionMeta } from '@/lib/waiter-board-session';

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
  const [{ data: sessions }, { data: rows }, checkoutRequested, { data: tableRows }] = await Promise.all([
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
  ]);

  const activeIds = new Set((sessions || []).map((s) => s.id as string));
  const orders = ((rows || []) as Order[]).filter(
    (o) => !o.session_id || activeIds.has(o.session_id as string),
  );
  const sessionMetaByTableId: Record<string, WaiterTableSessionMeta> = {};
  for (const s of sessions || []) {
    const tid = s.table_id as string | undefined;
    const sid = s.id as string | undefined;
    const openedAt = s.opened_at as string | undefined;
    const status = s.status as string | undefined;
    if (
      tid &&
      sid &&
      openedAt &&
      (status === 'open' || status === 'billing')
    ) {
      sessionMetaByTableId[tid] = {
        sessionId: sid,
        openedAt,
        status,
      };
    }
  }
  return {
    orders,
    sessionMetaByTableId,
    checkoutRequestedTableIds: checkoutRequested.tableIds,
    checkoutRequestedAtByTableId: checkoutRequested.atByTableId,
    tables: (tableRows || []) as RestaurantTableRow[],
  };
}
