'use client';

import { createClient } from '@/lib/supabase/client';
import type { Order } from '@/types';
import { compareRestaurantTables, type RestaurantTableRow } from '@/lib/restaurant-tables';
import {
  fetchCheckoutRequestedTableIds,
  fetchWaiterBoardOrders,
} from '@/components/waiter/waiter-board-queries';

/** Waiter board via Supabase + RLS (no Next.js board API). */
export async function fetchWaiterBoardClient(restaurantId: string) {
  const supabase = createClient();
  const [board, checkoutRequestedTableIds] = await Promise.all([
    fetchWaiterBoardOrders(supabase, restaurantId),
    fetchCheckoutRequestedTableIds(supabase, restaurantId),
  ]);
  return {
    orders: board.orders,
    activeSessionTableIds: board.activeSessionTableIds,
    checkoutRequestedTableIds,
  };
}

/** Kitchen active board via Supabase + RLS (no Next.js board API). */
export async function fetchKitchenBoardClient(restaurantId: string) {
  const supabase = createClient();
  const [{ data: orderRows }, { data: sessions }, { data: tableRows }] = await Promise.all([
    supabase
      .from('orders')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .in('status', ['pending', 'cooking'])
      .order('created_at', { ascending: true }),
    supabase
      .from('table_sessions')
      .select('id, table_id')
      .eq('restaurant_id', restaurantId)
      .in('status', ['open', 'billing']),
    supabase
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
  return { orders, activeTableIds, tableById };
}
