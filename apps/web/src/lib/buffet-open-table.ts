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

export type ApplyBuffetOpenSuccess = {
  ok: true;
  plan: BuffetOpenWritePlan;
  insertedOrderId?: string;
};

export type ApplyBuffetOpenResult =
  | ApplyBuffetOpenSuccess
  | { ok: false; code: 'conflict' | 'void_failed' | 'update_failed' | 'insert_failed'; message?: string };

/** Placeholder session id for optimistic open-table UI before the server responds. */
export const OPTIMISTIC_OPEN_SESSION_ID = '__optimistic_open__';

type VoidBuffetWrite = {
  orderId: string;
  items: OrderItem[];
  total_amount: number;
};

type CarrierBuffetWrite =
  | {
      mode: 'update';
      orderId: string;
      updated_at: string;
      items: OrderItem[];
      total_amount: number;
      status: Order['status'];
    }
  | {
      mode: 'insert';
      restaurant_id: string;
      session_id: string;
      table_id: string;
      display_name: string;
      items: OrderItem[];
      total_amount: number;
      status: Order['status'];
    };

export type BuffetOpenWritePlan = {
  voidOtherOrders: VoidBuffetWrite[];
  carrier: CarrierBuffetWrite;
};

type BuffetOpenParams = {
  tableId: string;
  displayName: string;
  line: OrderItem;
  restaurantId: string;
  sessionId: string;
};

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

export function mapToBuffetSessionOrders(
  rows: Array<{
    id: string;
    items: unknown;
    updated_at: string;
    table_id: string;
    created_at: string;
    status: Order['status'];
  }>,
): BuffetSessionOrder[] {
  return rows.map((row) => ({
    id: row.id,
    items: (row.items || []) as OrderItem[],
    updated_at: row.updated_at,
    table_id: row.table_id,
    created_at: row.created_at,
    status: row.status,
  }));
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

/** Pure write plan shared by server persist and optimistic client UI. */
export function planBuffetOpenWrites(
  sessionOrders: BuffetSessionOrder[],
  params: BuffetOpenParams,
): BuffetOpenWritePlan {
  const { tableId, displayName, line, restaurantId, sessionId } = params;
  const carrier = pickLatestTableOrder(sessionOrders, tableId);
  const voidOtherOrders: VoidBuffetWrite[] = [];

  for (const order of sessionOrders) {
    if (carrier && order.id === carrier.id) continue;

    const prevItems = order.items || [];
    const voidedItems = voidActiveBuffetBaseLines(prevItems);
    if (!buffetLinesChanged(prevItems, voidedItems)) continue;

    voidOtherOrders.push({
      orderId: order.id,
      items: voidedItems,
      total_amount: activeLineTotal(voidedItems, order.status),
    });
  }

  if (carrier) {
    const priorItems = carrier.items || [];
    const mergedItems = mergeBuffetLineOntoOrderItems(priorItems, line);
    return {
      voidOtherOrders,
      carrier: {
        mode: 'update',
        orderId: carrier.id,
        updated_at: carrier.updated_at,
        items: mergedItems,
        total_amount: activeLineTotal(mergedItems, carrier.status),
        status: menuItemsUnchanged(priorItems, mergedItems)
          ? carrier.status
          : deriveOrderStatusFromItems(mergedItems),
      },
    };
  }

  const mergedItems = [line];
  return {
    voidOtherOrders,
    carrier: {
      mode: 'insert',
      restaurant_id: restaurantId,
      session_id: sessionId,
      table_id: tableId,
      display_name: displayName,
      items: mergedItems,
      total_amount: sumLineTotals(mergedItems),
      status: deriveOrderStatusFromItems(mergedItems),
    },
  };
}

function patchOrderRow(order: Order, patch: Partial<Order>): Order {
  return { ...order, ...patch };
}

type ApplyWritePlanOptions = {
  now?: string;
  insertedOrderId?: string;
  optimisticTableId?: string;
};

/** Apply a buffet write plan in memory — shared by optimistic UI and buffet API response assembly. */
export function applyBuffetOpenWritePlanToOrders(
  orders: Order[],
  plan: BuffetOpenWritePlan,
  options: ApplyWritePlanOptions = {},
): Order[] {
  const now = options.now ?? new Date().toISOString();
  const next: Order[] = [...orders];

  for (const voidWrite of plan.voidOtherOrders) {
    const idx = next.findIndex((order) => order.id === voidWrite.orderId);
    if (idx < 0) continue;
    next[idx] = patchOrderRow(next[idx], {
      items: voidWrite.items,
      total_amount: voidWrite.total_amount,
      updated_at: now,
    });
  }

  if (plan.carrier.mode === 'update') {
    const carrier = plan.carrier;
    const idx = next.findIndex((order) => order.id === carrier.orderId);
    if (idx >= 0) {
      next[idx] = patchOrderRow(next[idx], {
        items: carrier.items,
        total_amount: carrier.total_amount,
        status: carrier.status,
        updated_at: now,
      });
    }
    return next;
  }

  const insert = plan.carrier;
  const orderId =
    options.insertedOrderId
    ?? (options.optimisticTableId
      ? `optimistic-order-${options.optimisticTableId}`
      : `optimistic-order-${insert.table_id}`);
  const insertedOrder: Order = {
    id: orderId,
    restaurant_id: insert.restaurant_id,
    session_id: insert.session_id,
    table_id: insert.table_id,
    display_name: insert.display_name,
    status: insert.status,
    items: insert.items,
    total_amount: insert.total_amount,
    created_at: now,
    updated_at: now,
  };
  return [insertedOrder, ...next];
}

/** In-memory buffet open for instant waiter UI; reconciled when the API returns. */
export function applyBuffetOpenOptimisticToOrders(
  orders: Order[],
  params: BuffetOpenParams,
): Order[] {
  const plan = planBuffetOpenWrites(mapToBuffetSessionOrders(orders), params);
  return applyBuffetOpenWritePlanToOrders(orders, plan, { optimisticTableId: params.tableId });
}

/**
 * Replace session buffet base fee for a table: void buffet on other session orders,
 * void+append on the table carrier order in a single update (avoids updated_at races).
 */
export async function applyBuffetOpenToSession(
  admin: SupabaseClient,
  params: BuffetOpenParams & { sessionOrders: BuffetSessionOrder[] },
): Promise<ApplyBuffetOpenResult> {
  const plan = planBuffetOpenWrites(params.sessionOrders, params);

  if (plan.voidOtherOrders.length > 0) {
    const voidResults = await Promise.all(
      plan.voidOtherOrders.map((voidWrite) =>
        admin
          .from('orders')
          .update({ items: voidWrite.items, total_amount: voidWrite.total_amount })
          .eq('id', voidWrite.orderId),
      ),
    );
    const voidError = voidResults.find((result) => result.error)?.error;
    if (voidError) {
      return { ok: false, code: 'void_failed', message: voidError.message };
    }
  }

  if (plan.carrier.mode === 'update') {
    const carrier = plan.carrier;
    const { data, error } = await admin
      .from('orders')
      .update({
        items: carrier.items,
        total_amount: carrier.total_amount,
        status: carrier.status,
      })
      .eq('id', carrier.orderId)
      .eq('updated_at', carrier.updated_at)
      .select('id')
      .maybeSingle();

    if (error) {
      return { ok: false, code: 'update_failed', message: error.message };
    }
    if (!data) {
      return { ok: false, code: 'conflict' };
    }
    return { ok: true, plan };
  }

  const insert = plan.carrier;
  const { data: inserted, error: insErr } = await admin
    .from('orders')
    .insert({
      restaurant_id: insert.restaurant_id,
      session_id: insert.session_id,
      table_id: insert.table_id,
      display_name: insert.display_name,
      status: insert.status,
      items: insert.items,
      total_amount: insert.total_amount,
    })
    .select('id')
    .single();

  if (insErr || !inserted) {
    return { ok: false, code: 'insert_failed', message: insErr?.message };
  }
  return { ok: true, plan, insertedOrderId: inserted.id as string };
}
