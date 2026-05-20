'use client';

import { createClient } from '@/lib/supabase/client';
import type { Order } from '@/types';
import {
  fetchCheckoutRequestedTables,
  fetchWaiterBoardOrders,
} from '@/components/waiter/waiter-board-queries';

/** Waiter board via Supabase + RLS (no Next.js board API). */
export async function fetchWaiterBoardClient(restaurantId: string) {
  const supabase = createClient();
  const [orders, checkoutRequestedTables] = await Promise.all([
    fetchWaiterBoardOrders(supabase, restaurantId),
    fetchCheckoutRequestedTables(supabase, restaurantId),
  ]);
  return { orders, checkoutRequestedTables };
}

/** Kitchen active board via Supabase + RLS (no Next.js board API). */
export async function fetchKitchenBoardClient(restaurantId: string) {
  const supabase = createClient();
  const [{ data: orderRows }, { data: sessions }] = await Promise.all([
    supabase
      .from('orders')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .in('status', ['pending', 'cooking'])
      .order('created_at', { ascending: true }),
    supabase
      .from('table_sessions')
      .select('id, table_number')
      .eq('restaurant_id', restaurantId)
      .in('status', ['open', 'billing']),
  ]);
  const activeIds = new Set((sessions || []).map((s) => s.id as string));
  const orders = ((orderRows || []) as Order[]).filter(
    (o) => !o.session_id || activeIds.has(o.session_id as string),
  );
  const activeTables = Array.from(
    new Set((sessions || []).map((s) => s.table_number as number)),
  ).sort((a, b) => a - b);
  return { orders, activeTables };
}
