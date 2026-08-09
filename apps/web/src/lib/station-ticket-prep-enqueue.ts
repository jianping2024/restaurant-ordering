import { randomUUID } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { OrderItem } from '@/types';
import { isBuffetBaseItem } from '@/lib/order-items';
import { loadMenuCategoriesForEnqueue } from '@/lib/menu-categories-server';
import { normalizeOrderItemStatus } from '@/lib/order-status';
import { resolveEffectivePrintStationId } from '@/lib/print-station-resolve';
import { normalizePrintLocale } from '@/lib/i18n';
import {
  formatTopCategoryTicketHeader,
  menuLocalizedName,
  orderItemStationSlipLabel,
  topLevelCategoryId,
  type MenuCategoryForStationTicket,
  type MenuItemForPrint,
} from '@/lib/menu-print-label';
import { isStationSlipShowCategoryGroupEnabled } from '@/lib/print-agent-config';
import { formatStationTicketOrderTime } from '@/lib/table-guest-count';
import {
  resolveGuestCountForStationTicket,
  resolvePrintAgentConfig,
  stationLabelForLocale,
  type RestaurantEnqueueRow,
  type StationRow,
  type StationTicketJobPayload,
} from '@/lib/station-ticket-enqueue';
import { parseTableIdParam } from '@/lib/restaurant-tables';

export type PrepSelection = {
  orderId: string;
  itemIndex: number;
};

type OrderRow = {
  id: string;
  restaurant_id: string;
  table_id: string;
  display_name: string | null;
  status: string;
  items: OrderItem[] | null;
  session_id: string | null;
  created_at: string;
  updated_at: string;
};

type PrepLine = {
  order: OrderRow;
  itemIndex: number;
  item: OrderItem;
};

/**
 * Enqueue station_ticket jobs for chef prep / remake:
 * only selected lines, grouped by table_id (one slip per table).
 */
export async function enqueueStationTicketsForPrepSelection(params: {
  admin: SupabaseClient;
  restaurant: RestaurantEnqueueRow;
  printStationId: string;
  selections: PrepSelection[];
}): Promise<
  | {
      ok: true;
      batch_id: string;
      inserted: number;
      station_names: string[];
    }
  | { ok: false; status: number; code: string; message?: string }
> {
  const { admin, restaurant, selections } = params;
  const restaurantId = restaurant.id;
  const locale = normalizePrintLocale(restaurant.print_locale);
  const printStationId = parseTableIdParam(params.printStationId);
  if (!printStationId) {
    return { ok: false, status: 400, code: 'invalid_print_station_id' };
  }

  if (!Array.isArray(selections) || selections.length === 0) {
    return { ok: false, status: 400, code: 'selections_required' };
  }

  const seen = new Set<string>();
  const normalized: PrepSelection[] = [];
  for (const sel of selections) {
    if (typeof sel?.orderId !== 'string' || typeof sel?.itemIndex !== 'number') {
      return { ok: false, status: 400, code: 'invalid_selection' };
    }
    if (!Number.isInteger(sel.itemIndex) || sel.itemIndex < 0) {
      return { ok: false, status: 400, code: 'invalid_item_index' };
    }
    const orderId = parseTableIdParam(sel.orderId);
    if (!orderId) {
      return { ok: false, status: 400, code: 'invalid_order_id' };
    }
    const key = `${orderId}:${sel.itemIndex}`;
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push({ orderId, itemIndex: sel.itemIndex });
  }

  if (normalized.length === 0) {
    return { ok: false, status: 400, code: 'selections_required' };
  }

  const { data: station, error: stErr } = await admin
    .from('print_stations')
    .select('id, name_pt, name_en, name_zh, kitchen_enabled')
    .eq('id', printStationId)
    .eq('restaurant_id', restaurantId)
    .maybeSingle();

  if (stErr) {
    return { ok: false, status: 500, code: 'stations_lookup_failed', message: stErr.message };
  }
  if (!station) {
    return { ok: false, status: 404, code: 'station_not_found' };
  }

  const stMeta = station as StationRow;
  const orderIds = Array.from(new Set(normalized.map((s) => s.orderId)));

  const { data: orderRows, error: oErr } = await admin
    .from('orders')
    .select(
      'id, restaurant_id, table_id, display_name, status, items, session_id, created_at, updated_at',
    )
    .eq('restaurant_id', restaurantId)
    .in('id', orderIds);

  if (oErr) {
    return { ok: false, status: 500, code: 'order_lookup_failed', message: oErr.message };
  }

  const orderById = new Map((orderRows || []).map((row) => [row.id as string, row as OrderRow]));
  if (orderById.size !== orderIds.length) {
    return { ok: false, status: 404, code: 'order_not_found' };
  }

  const prepLines: PrepLine[] = [];
  for (const sel of normalized) {
    const order = orderById.get(sel.orderId)!;
    const items = (order.items || []) as OrderItem[];
    const item = items[sel.itemIndex];
    if (!item) {
      return { ok: false, status: 400, code: 'item_index_out_of_range' };
    }
    if (isBuffetBaseItem(item)) {
      return { ok: false, status: 400, code: 'buffet_base_not_printable' };
    }
    const orderStatus = order.status as 'pending' | 'cooking' | 'done';
    if (normalizeOrderItemStatus(item, orderStatus) === 'voided') {
      return { ok: false, status: 400, code: 'item_voided' };
    }
    prepLines.push({ order, itemIndex: sel.itemIndex, item });
  }

  const menuIds = Array.from(new Set(prepLines.map((l) => l.item.id).filter(Boolean)));
  if (menuIds.length === 0) {
    return { ok: false, status: 400, code: 'no_printable_lines' };
  }

  let printAgentConfig: unknown;
  try {
    printAgentConfig = await resolvePrintAgentConfig(admin, restaurant);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'restaurant_lookup_failed';
    return { ok: false, status: 500, code: 'restaurant_lookup_failed', message };
  }
  const showCategoryGroup = isStationSlipShowCategoryGroupEnabled(printAgentConfig);

  const [menuResult, categoryList] = await Promise.all([
    admin
      .from('menu_items')
      .select('id, category_id, print_station_id, item_code')
      .eq('restaurant_id', restaurantId)
      .in('id', menuIds),
    loadMenuCategoriesForEnqueue(restaurantId),
  ]);

  if (menuResult.error) {
    return {
      ok: false,
      status: 500,
      code: 'menu_lookup_failed',
      message: menuResult.error.message,
    };
  }

  type CategoryRow = MenuCategoryForStationTicket & { print_station_id: string | null };
  const categoryById = new Map(categoryList.map((c) => [c.id, c as CategoryRow]));
  const menuById = new Map<string, MenuItemForPrint>();
  const resolveMap = new Map<string, string | null>();

  for (const row of menuResult.data || []) {
    const r = row as MenuItemForPrint & { print_station_id?: string | null };
    menuById.set(r.id, {
      id: r.id,
      category_id: r.category_id,
      item_code: r.item_code ?? null,
    });
    resolveMap.set(
      r.id,
      resolveEffectivePrintStationId(r.print_station_id ?? null, r.category_id, categoryList),
    );
  }

  for (const line of prepLines) {
    const eff = resolveMap.get(line.item.id) ?? null;
    if (eff !== printStationId) {
      return { ok: false, status: 400, code: 'station_mismatch' };
    }
  }

  function categoryGroupForMenuItem(menuItemId: string): { sort: number; header: string } {
    const row = menuById.get(menuItemId);
    const topId = topLevelCategoryId(row?.category_id ?? null, categoryList);
    const top = topId ? categoryById.get(topId) : null;
    if (!top) return { sort: 9999, header: '' };
    return {
      sort: top.sort_order ?? 0,
      header: formatTopCategoryTicketHeader(top, locale),
    };
  }

  const byTable = new Map<string, PrepLine[]>();
  for (const line of prepLines) {
    const tableId = line.order.table_id;
    const list = byTable.get(tableId) || [];
    list.push(line);
    byTable.set(tableId, list);
  }

  const batchId = `prep:${randomUUID()}`;
  let inserted = 0;
  const stationNames: string[] = [];

  for (const [, tableLines] of Array.from(byTable.entries())) {
    const primary = tableLines[0]!.order;
    let guestCount = 0;
    try {
      guestCount = await resolveGuestCountForStationTicket(admin, restaurantId, {
        status: primary.status,
        items: primary.items,
        session_id: primary.session_id,
        table_id: primary.table_id,
        created_at: primary.created_at,
        updated_at: primary.updated_at,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'guest_count_failed';
      return { ok: false, status: 500, code: 'session_orders_lookup_failed', message };
    }

    const orderTime = formatStationTicketOrderTime(
      primary.created_at || new Date().toISOString(),
    );

    const payload: StationTicketJobPayload = {
      order_id: primary.id,
      batch_id: batchId,
      print_station_id: printStationId,
      locale,
      station_display_name_pt: stMeta.name_pt,
      station_display_name_en: stMeta.name_en,
      station_display_name_zh: stMeta.name_zh,
      table_id: primary.table_id,
      display_name: primary.display_name || '',
      station_slip_options: { show_category_group: showCategoryGroup },
      ...(guestCount > 0 ? { guest_count: guestCount } : {}),
      ...(orderTime ? { order_time: orderTime } : {}),
      lines: tableLines.map((l: PrepLine) => {
        const group = categoryGroupForMenuItem(l.item.id);
        const itemName = menuLocalizedName(l.item, locale);
        const slipLabel = orderItemStationSlipLabel(l.item, locale);
        return {
          item_index: l.itemIndex,
          menu_item_id: l.item.id,
          qty: l.item.qty,
          note: l.item.note,
          item_code: l.item.item_code?.trim() || null,
          item_name: itemName,
          display_name: slipLabel,
          emoji: l.item.emoji || '🍽️',
          category_group_sort: group.sort,
          category_group_header: showCategoryGroup ? group.header : '',
        };
      }),
    };

    const { error: insErr } = await admin.from('print_jobs').insert({
      restaurant_id: restaurantId,
      type: 'station_ticket',
      payload,
      status: 'pending',
    });
    if (insErr) {
      return { ok: false, status: 500, code: 'insert_failed', message: insErr.message };
    }
    inserted += 1;
  }

  if (inserted > 0) {
    stationNames.push(stationLabelForLocale(stMeta, locale));
  }

  return {
    ok: true,
    batch_id: batchId,
    inserted,
    station_names: stationNames,
  };
}
