import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveTodayLisbonWindow } from '@/lib/analytics/date-window';
import { writeAppendBatch } from '@/lib/append-write-batch';
import { isBuffetBaseItem, isKitchenRemakeItem } from '@/lib/order-items';
import { normalizeOrderItemStatus } from '@/lib/order-status';
import { addCalendarDays, lisbonDayStartUtcIso } from '@/lib/lisbon-calendar';
import { loadMenuCategoriesForEnqueue } from '@/lib/menu-categories-server';
import { resolveEffectivePrintStationId } from '@/lib/print-station-resolve';
import { generateAppendBatchId } from '@/lib/resolve-append-cart-items';
import { parseTableIdParam } from '@/lib/restaurant-tables';
import {
  enqueueStationTicketsForOrder,
  type RestaurantEnqueueRow,
} from '@/lib/station-ticket-enqueue';
import { findActiveTableSession } from '@/lib/table-session-open';
import type { Order, OrderItem } from '@/types';

export type DishHistoryRow = {
  order_id: string;
  item_index: number;
  table_display: string;
  menu_item_id: string;
  name: string;
  item_code: string | null;
  qty: number;
  added_at: string;
  session_open: boolean;
  kitchen_remake?: boolean;
};

type FlatLine = DishHistoryRow & { sortKey: string };

const ACTIVE_ORDER_STATUSES = ['pending', 'cooking', 'done'] as const;

function parsePageSize(raw: string | null): number {
  const n = raw ? Number(raw) : 20;
  if (n === 20 || n === 50 || n === 100) return n;
  return 20;
}

function encodeCursor(row: FlatLine): string {
  return Buffer.from(
    JSON.stringify({
      a: row.added_at,
      o: row.order_id,
      i: row.item_index,
    }),
    'utf8',
  ).toString('base64url');
}

function decodeCursor(raw: string): { added_at: string; order_id: string; item_index: number } | null {
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as {
      a?: unknown;
      o?: unknown;
      i?: unknown;
    };
    if (typeof parsed.a !== 'string' || typeof parsed.o !== 'string' || typeof parsed.i !== 'number') {
      return null;
    }
    if (!Number.isInteger(parsed.i) || parsed.i < 0) return null;
    return { added_at: parsed.a, order_id: parsed.o, item_index: parsed.i };
  } catch {
    return null;
  }
}

function lineSortKey(addedAt: string, orderId: string, itemIndex: number): string {
  return `${addedAt}\0${orderId}\0${String(itemIndex).padStart(6, '0')}`;
}

function itemMatchesQuery(item: OrderItem, q: string): boolean {
  if (!q) return true;
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const name = (item.name || item.name_pt || '').toLowerCase();
  const code = (item.item_code || '').toLowerCase();
  const nameEn = (item.name_en || '').toLowerCase();
  const nameZh = (item.name_zh || '').toLowerCase();
  return (
    name.includes(needle) ||
    code.includes(needle) ||
    nameEn.includes(needle) ||
    nameZh.includes(needle)
  );
}

export async function listDishHistory(params: {
  admin: SupabaseClient;
  restaurantId: string;
  q: string | null;
  pageSizeRaw: string | null;
  cursorRaw: string | null;
}): Promise<
  | { ok: true; rows: DishHistoryRow[]; next_cursor: string | null; page_size: number }
  | { ok: false; status: number; error: string; message?: string }
> {
  const pageSize = parsePageSize(params.pageSizeRaw);
  const cursor = params.cursorRaw ? decodeCursor(params.cursorRaw) : null;
  if (params.cursorRaw && !cursor) {
    return { ok: false, status: 400, error: 'invalid_cursor' };
  }

  const { today, startUtc, endExclusiveUtc } = resolveTodayLisbonWindow();
  // Look back one calendar day so overnight sessions still contribute today's added_at lines.
  const orderLookbackUtc = lisbonDayStartUtcIso(addCalendarDays(today, -1));

  const { data: orderRows, error: oErr } = await params.admin
    .from('orders')
    .select('id, table_id, display_name, items, session_id, created_at, status')
    .eq('restaurant_id', params.restaurantId)
    .gte('created_at', orderLookbackUtc)
    .lt('created_at', endExclusiveUtc)
    .order('created_at', { ascending: false })
    .limit(800);

  if (oErr) {
    return { ok: false, status: 500, error: 'order_lookup_failed', message: oErr.message };
  }

  const sessionIds = Array.from(
    new Set(
      (orderRows || [])
        .map((r) => r.session_id as string | null)
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    ),
  );

  const openSessionIds = new Set<string>();
  if (sessionIds.length > 0) {
    const { data: sessions, error: sErr } = await params.admin
      .from('table_sessions')
      .select('id, status')
      .eq('restaurant_id', params.restaurantId)
      .in('id', sessionIds)
      .in('status', ['open', 'billing']);
    if (sErr) {
      return { ok: false, status: 500, error: 'session_lookup_failed', message: sErr.message };
    }
    for (const s of sessions || []) {
      openSessionIds.add(s.id as string);
    }
  }

  const q = params.q?.trim() || '';
  const flat: FlatLine[] = [];

  for (const order of orderRows || []) {
    const items = (order.items || []) as OrderItem[];
    const sessionId = order.session_id as string | null;
    const sessionOpen = Boolean(sessionId && openSessionIds.has(sessionId));
    for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
      const item = items[itemIndex];
      if (isBuffetBaseItem(item)) continue;
      if (normalizeOrderItemStatus(item, order.status as Order['status']) === 'voided') continue;
      if (!itemMatchesQuery(item, q)) continue;

      const addedAt =
        (typeof item.added_at === 'string' && item.added_at) ||
        (order.created_at as string) ||
        '';
      if (!addedAt || addedAt < startUtc || addedAt >= endExclusiveUtc) continue;

      const row: FlatLine = {
        order_id: order.id as string,
        item_index: itemIndex,
        table_display: ((order.display_name as string | null) || '').trim() || '—',
        menu_item_id: item.id,
        name: (item.name || item.name_pt || '').trim() || '—',
        item_code: item.item_code?.trim() || null,
        qty: Number(item.qty) || 0,
        added_at: addedAt,
        session_open: sessionOpen,
        ...(isKitchenRemakeItem(item) ? { kitchen_remake: true } : {}),
        sortKey: lineSortKey(addedAt, order.id as string, itemIndex),
      };
      flat.push(row);
    }
  }

  flat.sort((a, b) => b.sortKey.localeCompare(a.sortKey));

  let startIdx = 0;
  if (cursor) {
    const cursorKey = lineSortKey(cursor.added_at, cursor.order_id, cursor.item_index);
    startIdx = flat.findIndex((row) => row.sortKey < cursorKey);
    if (startIdx < 0) startIdx = flat.length;
  }

  const page = flat.slice(startIdx, startIdx + pageSize);
  const next = flat[startIdx + pageSize];
  const rows: DishHistoryRow[] = page.map(({ sortKey, ...row }) => {
    void sortKey;
    return row;
  });

  return {
    ok: true,
    rows,
    next_cursor: next ? encodeCursor(next) : null,
    page_size: pageSize,
  };
}

function pickLatestOpenOrder(
  rows: Array<Pick<Order, 'id' | 'status' | 'items' | 'created_at'>>,
): { id: string; items: OrderItem[] } | null {
  if (rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  const latest = sorted[0];
  if (!latest?.id) return null;
  return { id: latest.id, items: (latest.items || []) as OrderItem[] };
}

export async function remakeDishFromHistory(params: {
  admin: SupabaseClient;
  restaurant: RestaurantEnqueueRow;
  orderId: string;
  itemIndex: number;
  qty?: number | null;
}): Promise<
  | {
      ok: true;
      order_id: string;
      item_index: number;
      batch_id: string;
      printed: boolean;
    }
  | { ok: false; status: number; error: string; message?: string }
> {
  const orderId = parseTableIdParam(params.orderId);
  if (!orderId) {
    return { ok: false, status: 400, error: 'invalid_order_id' };
  }
  if (!Number.isInteger(params.itemIndex) || params.itemIndex < 0) {
    return { ok: false, status: 400, error: 'invalid_item_index' };
  }

  const restaurantId = params.restaurant.id;
  const { data: sourceOrder, error: oErr } = await params.admin
    .from('orders')
    .select('id, restaurant_id, table_id, display_name, status, items, session_id')
    .eq('id', orderId)
    .eq('restaurant_id', restaurantId)
    .maybeSingle();

  if (oErr) {
    return { ok: false, status: 500, error: 'order_lookup_failed', message: oErr.message };
  }
  if (!sourceOrder) {
    return { ok: false, status: 404, error: 'order_not_found' };
  }

  const sourceItems = (sourceOrder.items || []) as OrderItem[];
  const sourceItem = sourceItems[params.itemIndex];
  if (!sourceItem) {
    return { ok: false, status: 400, error: 'item_index_out_of_range' };
  }
  if (isBuffetBaseItem(sourceItem)) {
    return { ok: false, status: 400, error: 'buffet_base_not_remakeable' };
  }
  if (normalizeOrderItemStatus(sourceItem, sourceOrder.status as Order['status']) === 'voided') {
    return { ok: false, status: 400, error: 'item_voided' };
  }

  const qty =
    params.qty != null && Number.isFinite(params.qty)
      ? Math.floor(Number(params.qty))
      : Math.floor(Number(sourceItem.qty) || 0);
  if (!Number.isInteger(qty) || qty <= 0 || qty > 99) {
    return { ok: false, status: 400, error: 'invalid_qty' };
  }

  const tableId = sourceOrder.table_id as string;
  const session = await findActiveTableSession(params.admin, restaurantId, tableId);
  if (!session) {
    return { ok: false, status: 409, error: 'no_active_session' };
  }

  const { data: tableRow } = await params.admin
    .from('restaurant_tables')
    .select('display_name')
    .eq('restaurant_id', restaurantId)
    .eq('id', tableId)
    .is('deleted_at', null)
    .maybeSingle();

  const displayName =
    ((tableRow?.display_name as string | null) ||
      (sourceOrder.display_name as string | null) ||
      '').trim() || '—';

  const { data: sessionOrders, error: soErr } = await params.admin
    .from('orders')
    .select('id, status, items, created_at')
    .eq('restaurant_id', restaurantId)
    .eq('session_id', session.id)
    .in('status', [...ACTIVE_ORDER_STATUSES]);

  if (soErr) {
    return { ok: false, status: 500, error: 'order_query_failed', message: soErr.message };
  }

  const sessionOrderRows = (sessionOrders || []) as Array<
    Pick<Order, 'id' | 'status' | 'items' | 'created_at'>
  >;
  const openOrder = pickLatestOpenOrder(sessionOrderRows);

  // Resolve station for auto-print decision (kitchen_enabled → board only).
  let printStationId: string | null = null;
  const { data: menuRow } = await params.admin
    .from('menu_items')
    .select('id, category_id, print_station_id')
    .eq('restaurant_id', restaurantId)
    .eq('id', sourceItem.id)
    .maybeSingle();

  if (menuRow) {
    const categories = await loadMenuCategoriesForEnqueue(restaurantId);
    printStationId = resolveEffectivePrintStationId(
      (menuRow as { print_station_id?: string | null }).print_station_id,
      (menuRow as { category_id?: string | null }).category_id,
      categories,
    );
  }

  let kitchenEnabled = false;
  if (printStationId) {
    const { data: station } = await params.admin
      .from('print_stations')
      .select('id, kitchen_enabled')
      .eq('restaurant_id', restaurantId)
      .eq('id', printStationId)
      .maybeSingle();
    kitchenEnabled = Boolean((station as { kitchen_enabled?: boolean } | null)?.kitchen_enabled);
  }

  const batchId = generateAppendBatchId();
  const addedAt = new Date().toISOString();
  const remakeItem: OrderItem = {
    id: sourceItem.id,
    name: sourceItem.name,
    name_pt: sourceItem.name_pt,
    name_en: sourceItem.name_en,
    name_zh: sourceItem.name_zh,
    qty,
    note: sourceItem.note,
    price: 0,
    emoji: sourceItem.emoji || '🍽️',
    item_code: sourceItem.item_code ?? null,
    category_code_path: sourceItem.category_code_path,
    kind: sourceItem.kind,
    item_status: 'pending',
    batch_id: batchId,
    added_at: addedAt,
    kitchen_remake: true,
    ...(printStationId ? { print_station_id: printStationId } : {}),
  };

  const write = await writeAppendBatch({
    admin: params.admin,
    restaurantId,
    tableId,
    displayName,
    sessionId: session.id,
    context: {
      session,
      sessionOrders: sessionOrderRows,
      openOrder,
    },
    newItems: [remakeItem],
  });

  if (!write.ok) {
    return { ok: false, status: write.status, error: write.error };
  }

  // Re-read target order to get remake line index for print enqueue.
  const { data: targetOrder, error: tErr } = await params.admin
    .from('orders')
    .select('id, items')
    .eq('id', write.orderId)
    .maybeSingle();

  if (tErr || !targetOrder) {
    return { ok: false, status: 500, error: 'order_reload_failed', message: tErr?.message };
  }

  const targetItems = (targetOrder.items || []) as OrderItem[];
  let remakeIndex = -1;
  for (let i = targetItems.length - 1; i >= 0; i -= 1) {
    const it = targetItems[i];
    if (it.batch_id === batchId && isKitchenRemakeItem(it) && it.id === sourceItem.id) {
      remakeIndex = i;
      break;
    }
  }
  if (remakeIndex < 0) {
    return { ok: false, status: 500, error: 'remake_line_missing' };
  }

  let printed = false;
  if (!kitchenEnabled && printStationId) {
    const enqueue = await enqueueStationTicketsForOrder({
      admin: params.admin,
      restaurant: params.restaurant,
      orderId: write.orderId,
      batchId,
    });
    printed = enqueue.ok && enqueue.inserted > 0;
  }

  return {
    ok: true,
    order_id: write.orderId,
    item_index: remakeIndex,
    batch_id: batchId,
    printed,
  };
}
