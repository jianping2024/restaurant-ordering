import type { SupabaseClient } from '@supabase/supabase-js';
import type { OrderItem } from '@/types';
import type { AppendWriteContext } from '@/lib/append-write-context';
import { BUFFET_CHANGED } from '@/lib/buffet-checkout-entry';

export type WriteAppendBatchParams = {
  admin: SupabaseClient;
  restaurantId: string;
  tableId: string;
  displayName: string;
  sessionId: string;
  /** Kept for call-site compatibility; merge target is resolved under lock inside RPC. */
  context: AppendWriteContext;
  newItems: OrderItem[];
  /**
   * Table buffet the dish lines were priced for (`resolveAppendCartItems().pricedBuffetId`).
   * The RPC rejects with `buffet_changed` (409) when the table's buffet differs under lock.
   * Null for writes without buffet-priced dish lines (packaging, take-away charge, remake).
   */
  pricedBuffetId: string | null;
};

export type WriteAppendBatchResult =
  | {
      ok: true;
      orderId: string;
      hadDoneBefore: boolean;
      isFirstOrder: boolean;
    }
  | { ok: false; status: number; error: string };

type AppendOrderItemsRpc = {
  ok?: boolean;
  order_id?: string;
  had_done_before?: boolean;
  is_first_order?: boolean;
  code?: string;
};

/**
 * Sole append persist: RPC `append_order_items` (session advisory lock + latest order FOR UPDATE).
 * Do not read-merge-write `orders.items` in TypeScript beside this.
 */
export async function writeAppendBatch(params: WriteAppendBatchParams): Promise<WriteAppendBatchResult> {
  const { admin, restaurantId, tableId, displayName, sessionId, newItems, pricedBuffetId } = params;

  const { data, error } = await admin.rpc('append_order_items', {
    p_restaurant_id: restaurantId,
    p_session_id: sessionId,
    p_table_id: tableId,
    p_display_name: displayName,
    p_new_items: newItems,
    p_priced_buffet_id: pricedBuffetId,
  });

  if (error) {
    return { ok: false, status: 500, error: 'order_update_failed' };
  }

  const row = (data ?? {}) as AppendOrderItemsRpc;
  if (!row.ok || !row.order_id) {
    const code = row.code || 'order_update_failed';
    if (code === 'invalid_items' || code === 'invalid_args') {
      return { ok: false, status: 400, error: code };
    }
    if (code === BUFFET_CHANGED) {
      return { ok: false, status: 409, error: code };
    }
    return { ok: false, status: 500, error: code };
  }

  return {
    ok: true,
    orderId: row.order_id,
    hadDoneBefore: row.had_done_before === true,
    isFirstOrder: row.is_first_order === true,
  };
}
