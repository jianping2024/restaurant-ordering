import type { SupabaseClient } from '@supabase/supabase-js';
import type { Order, OrderItem } from '@/types';
import { computeOrderTotalsFromItems } from '@/lib/order-item-void/persist-order-items-update';
import type { AppendWriteContext } from '@/lib/append-write-context';

export type WriteAppendBatchParams = {
  admin: SupabaseClient;
  restaurantId: string;
  tableId: string;
  displayName: string;
  sessionId: string;
  context: AppendWriteContext;
  newItems: OrderItem[];
};

export type WriteAppendBatchResult =
  | {
      ok: true;
      orderId: string;
      hadDoneBefore: boolean;
      isFirstOrder: boolean;
    }
  | { ok: false; status: number; error: string };

export async function writeAppendBatch(params: WriteAppendBatchParams): Promise<WriteAppendBatchResult> {
  const { admin, restaurantId, tableId, displayName, sessionId, context, newItems } = params;
  const openOrder = context.openOrder;

  if (openOrder?.id) {
    const prior = openOrder.items || [];
    const hadDoneBefore =
      prior.length > 0 && prior.every((item) => (item.item_status || 'pending') === 'done');
    const mergedItems = [...prior, ...newItems];
    const openRow = context.sessionOrders.find((row) => row.id === openOrder.id);
    const orderStatus = (openRow?.status ?? 'pending') as Order['status'];
    const { nextStatus, total_amount } = computeOrderTotalsFromItems(mergedItems, orderStatus);
    const { error: updErr } = await admin
      .from('orders')
      .update({
        items: mergedItems,
        total_amount,
        status: nextStatus,
      })
      .eq('id', openOrder.id);
    if (updErr) {
      return { ok: false, status: 500, error: 'order_update_failed' };
    }
    return {
      ok: true,
      orderId: openOrder.id,
      hadDoneBefore,
      isFirstOrder: false,
    };
  }

  const { nextStatus, total_amount } = computeOrderTotalsFromItems(newItems, 'pending');
  const { data: inserted, error: insErr } = await admin
    .from('orders')
    .insert({
      restaurant_id: restaurantId,
      session_id: sessionId,
      table_id: tableId,
      display_name: displayName,
      status: nextStatus,
      items: newItems,
      total_amount,
    })
    .select('id')
    .single();

  if (insErr || !inserted) {
    return { ok: false, status: 500, error: 'order_insert_failed' };
  }

  return {
    ok: true,
    orderId: inserted.id as string,
    hadDoneBefore: false,
    isFirstOrder: true,
  };
}
