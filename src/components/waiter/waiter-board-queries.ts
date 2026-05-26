import type { Order } from '@/types';
import { createClient } from '@/lib/supabase/client';

/** 只展示仍挂在 open/billing 餐次上的订单；关台后同批订单不再出现在看板。 */
export async function fetchWaiterBoardOrders(
  supabase: ReturnType<typeof createClient>,
  restaurantId: string,
) {
  const [{ data: sessions }, { data: rows }] = await Promise.all([
    supabase
      .from('table_sessions')
      .select('id, table_id')
      .eq('restaurant_id', restaurantId)
      .in('status', ['open', 'billing']),
    supabase
      .from('orders')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .in('status', ['pending', 'cooking', 'done'])
      .order('updated_at', { ascending: false })
      .limit(200),
  ]);
  const activeIds = new Set((sessions || []).map((s) => s.id as string));
  const activeSessionTableIds = Array.from(
    new Set(
      (sessions || [])
        .map((s) => s.table_id as string)
        .filter(Boolean),
    ),
  );
  const orders = (rows || []) as Order[];
  return {
    orders: orders.filter((o) => !o.session_id || activeIds.has(o.session_id)),
    activeSessionTableIds,
  };
}

export async function fetchCheckoutRequestedTableIds(
  supabase: ReturnType<typeof createClient>,
  restaurantId: string,
) {
  const { data } = await supabase
    .from('bill_splits')
    .select('table_id')
    .eq('restaurant_id', restaurantId)
    .eq('status', 'requested');
  return Array.from(
    new Set(
      (data || [])
        .map((row) => row.table_id as string)
        .filter(Boolean),
    ),
  );
}
