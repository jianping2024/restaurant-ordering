import type { SupabaseClient } from '@supabase/supabase-js';
import { sumLineTotals } from '@/lib/cart-totals';
import { deriveOrderStatusFromItems, normalizeOrderItemStatus } from '@/lib/order-status';
import type { Order, OrderItem } from '@/types';

export function computeOrderTotalsFromItems(
  items: OrderItem[],
  orderStatusFallback: Order['status'] = 'pending',
): { nextStatus: Order['status']; total_amount: number } {
  const nextStatus = deriveOrderStatusFromItems(items);
  const activeItems = items.filter(
    (item) => normalizeOrderItemStatus(item, orderStatusFallback) !== 'voided',
  );
  return {
    nextStatus,
    total_amount: sumLineTotals(activeItems),
  };
}

export async function persistOrderItemsUpdate(
  admin: SupabaseClient,
  params: {
    orderId: string;
    restaurantId: string;
    updatedAt: string;
    items: OrderItem[];
    orderStatusFallback?: Order['status'];
  },
): Promise<{ ok: true; order: Order } | { ok: false; code: 'conflict' }> {
  const { nextStatus, total_amount } = computeOrderTotalsFromItems(
    params.items,
    params.orderStatusFallback ?? 'pending',
  );

  const { data: updated, error } = await admin
    .from('orders')
    .update({ items: params.items, status: nextStatus, total_amount })
    .eq('id', params.orderId)
    .eq('restaurant_id', params.restaurantId)
    .eq('updated_at', params.updatedAt)
    .select('*')
    .maybeSingle();

  if (error || !updated) {
    return { ok: false, code: 'conflict' };
  }

  return { ok: true, order: updated as Order };
}
