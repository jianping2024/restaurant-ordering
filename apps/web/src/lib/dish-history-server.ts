import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveTodayLisbonWindow } from '@/lib/analytics/date-window';
import { writeAppendBatch } from '@/lib/append-write-batch';
import { isBuffetBaseItem, isKitchenRemakeItem } from '@/lib/order-items';
import { normalizeOrderItemStatus } from '@/lib/order-status';
import { loadMenuCategoriesForEnqueue } from '@/lib/menu-categories-server';
import {
  isListPageSize,
  LIST_DEFAULT_PAGE_SIZE,
  paginateList,
  type ListPageSize,
} from '@/lib/paginate-list';
import { resolveEffectivePrintStationId } from '@/lib/print-station-resolve';
import { generateAppendBatchId } from '@/lib/resolve-append-cart-items';
import { parseTableIdParam } from '@/lib/restaurant-tables';
import {
  enqueueStationTicketsForOrder,
  type RestaurantEnqueueRow,
} from '@/lib/station-ticket-enqueue';
import { findActiveTableSession } from '@/lib/table-session-open';
import { resolveMenuItemLocalizedName } from '@/lib/menu-item-display';
import type { UILanguage } from '@/lib/i18n';
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

export type DishHistoryListResult = {
  items: DishHistoryRow[];
  page: number;
  pageSize: ListPageSize;
  total: number;
};

type FlatLine = DishHistoryRow & { sortKey: string };

const ACTIVE_ORDER_STATUSES = ['pending', 'cooking', 'done'] as const;
const ORDERS_FETCH_PAGE = 1000;

type DishHistoryOrderRow = {
  id: string;
  display_name: string | null;
  items: OrderItem[] | null;
  session_id: string | null;
  created_at: string;
  status: Order['status'];
};

function parseListPage(raw: string | null): number {
  const n = raw ? Number.parseInt(raw, 10) : 1;
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

function parseListPageSizeParam(raw: string | null): ListPageSize {
  const n = raw ? Number.parseInt(raw, 10) : LIST_DEFAULT_PAGE_SIZE;
  return isListPageSize(n) ? n : LIST_DEFAULT_PAGE_SIZE;
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
  pageRaw: string | null;
  pageSizeRaw: string | null;
  lang: UILanguage;
}): Promise<
  | { ok: true } & DishHistoryListResult
  | { ok: false; status: number; error: string; message?: string }
> {
  const page = parseListPage(params.pageRaw);
  const pageSize = parseListPageSizeParam(params.pageSizeRaw);
  const { startUtc, endExclusiveUtc } = resolveTodayLisbonWindow();

  const orderRows: DishHistoryOrderRow[] = [];
  for (let from = 0; ; from += ORDERS_FETCH_PAGE) {
    const { data, error: oErr } = await params.admin
      .from('orders')
      .select('id, display_name, items, session_id, created_at, status')
      .eq('restaurant_id', params.restaurantId)
      .gte('created_at', startUtc)
      .lt('created_at', endExclusiveUtc)
      .order('created_at', { ascending: false })
      .range(from, from + ORDERS_FETCH_PAGE - 1);
    if (oErr) {
      return { ok: false, status: 500, error: 'order_lookup_failed', message: oErr.message };
    }
    const batch = (data || []) as DishHistoryOrderRow[];
    orderRows.push(...batch);
    if (batch.length < ORDERS_FETCH_PAGE) break;
  }

  const openSessionIds = new Set<string>();
  if (orderRows.length > 0) {
    const { data: sessions, error: sErr } = await params.admin
      .from('table_sessions')
      .select('id')
      .eq('restaurant_id', params.restaurantId)
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

  for (const order of orderRows) {
    const items = order.items || [];
    const sessionOpen = Boolean(order.session_id && openSessionIds.has(order.session_id));
    for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
      const item = items[itemIndex];
      if (isBuffetBaseItem(item)) continue;
      if (normalizeOrderItemStatus(item, order.status) === 'voided') continue;
      if (!itemMatchesQuery(item, q)) continue;

      const addedAt =
        (typeof item.added_at === 'string' && item.added_at) || order.created_at || '';
      if (!addedAt || addedAt < startUtc || addedAt >= endExclusiveUtc) continue;

      flat.push({
        order_id: order.id,
        item_index: itemIndex,
        table_display: (order.display_name || '').trim() || '—',
        menu_item_id: item.id,
        name: resolveMenuItemLocalizedName(item, params.lang) || '—',
        item_code: item.item_code?.trim() || null,
        qty: Number(item.qty) || 0,
        added_at: addedAt,
        session_open: sessionOpen,
        ...(isKitchenRemakeItem(item) ? { kitchen_remake: true } : {}),
        sortKey: lineSortKey(addedAt, order.id, itemIndex),
      });
    }
  }

  flat.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  const allRows: DishHistoryRow[] = flat.map(({ sortKey, ...row }) => {
    void sortKey;
    return row;
  });
  const paged = paginateList(allRows, page, pageSize);

  return {
    ok: true,
    items: paged.rows,
    page: paged.page,
    pageSize,
    total: paged.total,
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
