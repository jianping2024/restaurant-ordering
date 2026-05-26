import type { SupabaseClient } from '@supabase/supabase-js';
import type { Order } from '@/types';
import { compareRestaurantTables, type RestaurantTableRow } from '@/lib/restaurant-tables';

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

  return { orders, activeTableIds, tableById };
}

export async function fetchWaiterBoard(admin: SupabaseClient, restaurantId: string) {
  const [{ data: sessions }, { data: rows }, checkoutTables] = await Promise.all([
    admin
      .from('table_sessions')
      .select('id, table_id')
      .eq('restaurant_id', restaurantId)
      .in('status', ['open', 'billing']),
    admin
      .from('orders')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .in('status', ['pending', 'cooking', 'done'])
      .order('updated_at', { ascending: false })
      .limit(200),
    admin
      .from('bill_splits')
      .select('table_id')
      .eq('restaurant_id', restaurantId)
      .eq('status', 'requested'),
  ]);

  const activeIds = new Set((sessions || []).map((s) => s.id as string));
  const orders = ((rows || []) as Order[]).filter(
    (o) => !o.session_id || activeIds.has(o.session_id as string),
  );
  const activeSessionTableIds = Array.from(
    new Set(
      (sessions || [])
        .map((s) => s.table_id as string)
        .filter(Boolean),
    ),
  );
  const checkoutRequestedTableIds = Array.from(
    new Set(
      (checkoutTables.data || [])
        .map((row) => row.table_id as string)
        .filter(Boolean),
    ),
  );

  return { orders, activeSessionTableIds, checkoutRequestedTableIds };
}
