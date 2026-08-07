import type { SupabaseClient } from '@supabase/supabase-js';
import { isBuffetBaseItem } from '@/lib/order-items';
import { persistOrderItemsUpdate } from '@/lib/order-item-void/persist-order-items-update';
import {
  effectiveItemStatus,
  normalizeOrderItemStatus,
} from '@/lib/order-status';
import { kitchenReadyAfterMinutesFromConfig } from '@/lib/print-agent-config';
import { parseTableIdParam } from '@/lib/restaurant-tables';
import {
  enqueueStationTicketsForPrepSelection,
  type PrepSelection,
} from '@/lib/station-ticket-prep-enqueue';
import type { RestaurantEnqueueRow } from '@/lib/station-ticket-enqueue';
import type { Order, OrderItem } from '@/types';

export type KitchenLineSelection = {
  orderId: string;
  itemIndex: number;
};

type OrderRow = {
  id: string;
  restaurant_id: string;
  table_id: string;
  display_name: string | null;
  status: Order['status'];
  items: OrderItem[] | null;
  updated_at: string;
};

function parseSelections(raw: unknown): KitchenLineSelection[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: KitchenLineSelection[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    if (!row || typeof row !== 'object') return null;
    const orderIdRaw =
      typeof (row as { order_id?: unknown }).order_id === 'string'
        ? (row as { order_id: string }).order_id
        : typeof (row as { orderId?: unknown }).orderId === 'string'
          ? (row as { orderId: string }).orderId
          : null;
    const itemIndexRaw =
      typeof (row as { item_index?: unknown }).item_index === 'number'
        ? (row as { item_index: number }).item_index
        : typeof (row as { itemIndex?: unknown }).itemIndex === 'number'
          ? (row as { itemIndex: number }).itemIndex
          : null;
    if (!orderIdRaw || itemIndexRaw == null) return null;
    if (!Number.isInteger(itemIndexRaw) || itemIndexRaw < 0) return null;
    const orderId = parseTableIdParam(orderIdRaw);
    if (!orderId) return null;
    const key = `${orderId}:${itemIndexRaw}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ orderId, itemIndex: itemIndexRaw });
  }
  return out.length > 0 ? out : null;
}

/** Accept `{ selections }` or a single `{ order_id, item_index }`. */
export function parseKitchenLineSelections(body: unknown): KitchenLineSelection[] | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const o = body as Record<string, unknown>;
  if (Array.isArray(o.selections)) return parseSelections(o.selections);
  return parseSelections([o]);
}

export async function applyKitchenPrep(params: {
  admin: SupabaseClient;
  restaurant: RestaurantEnqueueRow;
  printStationId: string;
  selections: KitchenLineSelection[];
}): Promise<
  | { ok: true; printed_tables: string[]; errors?: string[] }
  | { ok: false; status: number; error: string; message?: string }
> {
  const { admin, restaurant, selections } = params;
  const restaurantId = restaurant.id;
  const printStationId = parseTableIdParam(params.printStationId);
  if (!printStationId) {
    return { ok: false, status: 400, error: 'invalid_print_station_id' };
  }
  if (selections.length === 0) {
    return { ok: false, status: 400, error: 'selections_required' };
  }

  const orderIds = Array.from(new Set(selections.map((s) => s.orderId)));
  const { data: orderRows, error: oErr } = await admin
    .from('orders')
    .select('id, restaurant_id, table_id, display_name, status, items, updated_at')
    .eq('restaurant_id', restaurantId)
    .in('id', orderIds);

  if (oErr) {
    return { ok: false, status: 500, error: 'order_lookup_failed', message: oErr.message };
  }

  const orderById = new Map((orderRows || []).map((row) => [row.id as string, row as OrderRow]));
  if (orderById.size !== orderIds.length) {
    return { ok: false, status: 404, error: 'order_not_found' };
  }

  const nowIso = new Date().toISOString();
  const nextByOrder = new Map<string, { row: OrderRow; items: OrderItem[] }>();

  for (const sel of selections) {
    const row = orderById.get(sel.orderId)!;
    const working = nextByOrder.get(sel.orderId) ?? {
      row,
      items: [...((row.items || []) as OrderItem[])],
    };
    const item = working.items[sel.itemIndex];
    if (!item) {
      return { ok: false, status: 400, error: 'item_index_out_of_range' };
    }
    if (isBuffetBaseItem(item)) {
      return { ok: false, status: 400, error: 'buffet_base_not_prepable' };
    }
    const stored = normalizeOrderItemStatus(item, row.status);
    if (stored === 'voided') {
      return { ok: false, status: 400, error: 'item_voided' };
    }
    if (stored === 'done') {
      return { ok: false, status: 400, error: 'item_already_done' };
    }

    // pending → cooking; already cooking/ready → keep cooking for 补打 (no started_at reset).
    working.items[sel.itemIndex] = {
      ...item,
      item_status: 'cooking',
      started_at: item.started_at || nowIso,
    };
    nextByOrder.set(sel.orderId, working);
  }

  for (const { row, items } of Array.from(nextByOrder.values())) {
    const persisted = await persistOrderItemsUpdate(admin, {
      orderId: row.id,
      restaurantId,
      updatedAt: row.updated_at,
      items,
      orderStatusFallback: row.status,
    });
    if (!persisted.ok) {
      return { ok: false, status: 409, error: 'conflict' };
    }
  }

  const prepSelections: PrepSelection[] = selections.map((s) => ({
    orderId: s.orderId,
    itemIndex: s.itemIndex,
  }));

  const printed = await enqueueStationTicketsForPrepSelection({
    admin,
    restaurant,
    printStationId,
    selections: prepSelections,
  });

  if (!printed.ok) {
    return {
      ok: true,
      printed_tables: [],
      errors: [printed.code],
    };
  }

  const printedTables = Array.from(
    new Set(
      selections
        .map((s) => orderById.get(s.orderId)?.display_name?.trim() || '')
        .filter(Boolean),
    ),
  );

  return { ok: true, printed_tables: printedTables };
}

export async function applyKitchenServe(params: {
  admin: SupabaseClient;
  restaurantId: string;
  printAgentConfig: unknown;
  selections: KitchenLineSelection[];
}): Promise<
  | { ok: true; served: number }
  | { ok: false; status: number; error: string; message?: string }
> {
  const { admin, restaurantId, selections } = params;
  if (selections.length === 0) {
    return { ok: false, status: 400, error: 'selections_required' };
  }

  const readyAfterMinutes = kitchenReadyAfterMinutesFromConfig(params.printAgentConfig);
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  const orderIds = Array.from(new Set(selections.map((s) => s.orderId)));
  const { data: orderRows, error: oErr } = await admin
    .from('orders')
    .select('id, restaurant_id, status, items, updated_at')
    .eq('restaurant_id', restaurantId)
    .in('id', orderIds);

  if (oErr) {
    return { ok: false, status: 500, error: 'order_lookup_failed', message: oErr.message };
  }

  const orderById = new Map(
    (orderRows || []).map((row) => [
      row.id as string,
      row as Pick<OrderRow, 'id' | 'restaurant_id' | 'status' | 'items' | 'updated_at'>,
    ]),
  );
  if (orderById.size !== orderIds.length) {
    return { ok: false, status: 404, error: 'order_not_found' };
  }

  const nextByOrder = new Map<
    string,
    {
      row: Pick<OrderRow, 'id' | 'restaurant_id' | 'status' | 'items' | 'updated_at'>;
      items: OrderItem[];
    }
  >();
  let served = 0;

  for (const sel of selections) {
    const row = orderById.get(sel.orderId)!;
    const working = nextByOrder.get(sel.orderId) ?? {
      row,
      items: [...((row.items || []) as OrderItem[])],
    };
    const item = working.items[sel.itemIndex];
    if (!item) {
      return { ok: false, status: 400, error: 'item_index_out_of_range' };
    }
    if (isBuffetBaseItem(item)) {
      return { ok: false, status: 400, error: 'buffet_base_not_servable' };
    }

    const stored = normalizeOrderItemStatus(item, row.status);
    if (stored === 'voided') {
      return { ok: false, status: 400, error: 'item_voided' };
    }
    if (stored === 'done') {
      return { ok: false, status: 400, error: 'item_already_done' };
    }

    const effective = effectiveItemStatus({
      item,
      orderStatus: row.status,
      nowMs,
      readyAfterMinutes,
    });
    if (effective !== 'ready') {
      return { ok: false, status: 400, error: 'item_not_ready' };
    }

    // Single write path: cooking/ready → done (never write ready).
    working.items[sel.itemIndex] = {
      ...item,
      item_status: 'done',
      done_at: nowIso,
      started_at: item.started_at || nowIso,
    };
    nextByOrder.set(sel.orderId, working);
    served += 1;
  }

  for (const { row, items } of Array.from(nextByOrder.values())) {
    const persisted = await persistOrderItemsUpdate(admin, {
      orderId: row.id,
      restaurantId,
      updatedAt: row.updated_at,
      items,
      orderStatusFallback: row.status,
    });
    if (!persisted.ok) {
      return { ok: false, status: 409, error: 'conflict' };
    }
  }

  return { ok: true, served };
}
