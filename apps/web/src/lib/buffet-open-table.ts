import type { SupabaseClient } from '@supabase/supabase-js';
import type { Order, OrderItem } from '@/types';
import { mergeBuffetLineOntoOrderItems, voidActiveBuffetBaseLines } from '@/lib/buffet-order';
import { sumLineTotals } from '@/lib/cart-totals';
import { isBuffetBaseItem } from '@/lib/order-items';
import { deriveOrderStatusFromItems, normalizeOrderItemStatus } from '@/lib/order-status';
import { tableIdsEqual } from '@/lib/restaurant-tables';

export type BuffetSessionOrder = {
  id: string;
  items: OrderItem[];
  updated_at: string;
  table_id: string;
  created_at: string;
  status: Order['status'];
};

export type ApplyBuffetOpenResult =
  | { ok: true }
  | { ok: false; code: 'conflict' | 'void_failed' | 'update_failed' | 'insert_failed'; message?: string };

/** Latest order row for a table within the session (carrier for new buffet line). */
export function pickLatestTableOrder(
  sessionOrders: BuffetSessionOrder[],
  tableId: string,
): BuffetSessionOrder | null {
  const tableOrders = sessionOrders
    .filter((row) => tableIdsEqual(row.table_id, tableId))
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  return tableOrders[0] ?? null;
}

function buffetLinesChanged(before: OrderItem[], after: OrderItem[]): boolean {
  return JSON.stringify(before) !== JSON.stringify(after);
}

function menuItemsSnapshot(items: OrderItem[]): OrderItem[] {
  return items.filter((item) => !isBuffetBaseItem(item));
}

function menuItemsUnchanged(before: OrderItem[], after: OrderItem[]): boolean {
  return JSON.stringify(menuItemsSnapshot(before)) === JSON.stringify(menuItemsSnapshot(after));
}

function activeLineTotal(items: OrderItem[], orderStatus: Order['status']): number {
  const active = items.filter(
    (item) => normalizeOrderItemStatus(item, orderStatus) !== 'voided',
  );
  return sumLineTotals(active);
}

/**
 * Replace session buffet base fee for a table: void buffet on other session orders,
 * void+append on the table carrier order in a single update (avoids updated_at races).
 */
export async function applyBuffetOpenToSession(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    sessionId: string;
    tableId: string;
    displayName: string;
    line: OrderItem;
    sessionOrders: BuffetSessionOrder[];
  },
): Promise<ApplyBuffetOpenResult> {
  const { restaurantId, sessionId, tableId, displayName, line, sessionOrders } = params;
  const carrier = pickLatestTableOrder(sessionOrders, tableId);

  for (const order of sessionOrders) {
    if (carrier && order.id === carrier.id) continue;

    const prevItems = order.items || [];
    const voidedItems = voidActiveBuffetBaseLines(prevItems);
    if (!buffetLinesChanged(prevItems, voidedItems)) continue;

    const voidedTotal = activeLineTotal(voidedItems, order.status);
    const { error } = await admin
      .from('orders')
      .update({ items: voidedItems, total_amount: voidedTotal })
      .eq('id', order.id);

    if (error) {
      return { ok: false, code: 'void_failed', message: error.message };
    }
  }

  if (carrier) {
    const priorItems = carrier.items || [];
    const mergedItems = mergeBuffetLineOntoOrderItems(priorItems, line);
    const total = activeLineTotal(mergedItems, carrier.status);
    const nextStatus = menuItemsUnchanged(priorItems, mergedItems)
      ? carrier.status
      : deriveOrderStatusFromItems(mergedItems);

    const { data, error } = await admin
      .from('orders')
      .update({
        items: mergedItems,
        total_amount: total,
        status: nextStatus,
      })
      .eq('id', carrier.id)
      .eq('updated_at', carrier.updated_at)
      .select('id')
      .maybeSingle();

    if (error) {
      return { ok: false, code: 'update_failed', message: error.message };
    }
    if (!data) {
      return { ok: false, code: 'conflict' };
    }
    return { ok: true };
  }

  const mergedItems = [line];
  const total = sumLineTotals(mergedItems);
  const nextStatus = deriveOrderStatusFromItems(mergedItems);

  const { error: insErr } = await admin.from('orders').insert({
    restaurant_id: restaurantId,
    session_id: sessionId,
    table_id: tableId,
    display_name: displayName,
    status: nextStatus,
    items: mergedItems,
    total_amount: total,
  });

  if (insErr) {
    return { ok: false, code: 'insert_failed', message: insErr.message };
  }
  return { ok: true };
}
