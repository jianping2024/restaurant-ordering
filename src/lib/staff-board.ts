import type { SupabaseClient } from '@supabase/supabase-js';
import type { Order } from '@/types';

export async function fetchKitchenBoard(admin: SupabaseClient, restaurantId: string) {
  const [{ data: orderRows }, { data: sessions }] = await Promise.all([
    admin
      .from('orders')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .in('status', ['pending', 'cooking'])
      .order('created_at', { ascending: true }),
    admin
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

export async function fetchWaiterBoard(admin: SupabaseClient, restaurantId: string) {
  const [{ data: sessions }, { data: rows }, checkoutTables] = await Promise.all([
    admin
      .from('table_sessions')
      .select('id')
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
      .select('table_number')
      .eq('restaurant_id', restaurantId)
      .eq('status', 'requested'),
  ]);

  const activeIds = new Set((sessions || []).map((s) => s.id as string));
  const orders = ((rows || []) as Order[]).filter(
    (o) => !o.session_id || activeIds.has(o.session_id as string),
  );
  const checkoutRequestedTables = Array.from(
    new Set(
      (checkoutTables.data || [])
        .map((row) => Number(row.table_number))
        .filter((n) => Number.isFinite(n)),
    ),
  );

  return { orders, checkoutRequestedTables };
}
