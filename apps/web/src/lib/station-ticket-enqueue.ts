import type { SupabaseClient } from '@supabase/supabase-js';
import type { OrderItem } from '@/types';
import { isBuffetBaseItem } from '@/lib/order-items';
import { normalizeOrderItemStatus } from '@/lib/order-status';
import { resolveEffectivePrintStationId } from '@/lib/print-station-resolve';
import {
  formatTopCategoryTicketHeader,
  orderItemBaseName,
  orderItemStationSlipLabel,
  topLevelCategoryId,
  type MenuCategoryForStationTicket,
  type MenuItemForPrint,
} from '@/lib/menu-print-label';
import { isStationSlipShowCategoryGroupEnabled } from '@/lib/print-agent-config';
import {
  formatStationTicketOrderTime,
  guestCountFromTableOrders,
  stationTicketOrderTimeIso,
} from '@/lib/table-guest-count';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}

export function orderItemBatchKey(item: OrderItem): string {
  return item.batch_id || 'legacy';
}

type StationRow = {
  id: string;
  name_pt: string;
  name_en: string | null;
  name_zh: string | null;
};

function stationLabelForLocale(st: StationRow, locale: 'zh' | 'en' | 'pt'): string {
  if (locale === 'zh') return (st.name_zh || st.name_en || st.name_pt || '').trim() || st.name_pt;
  if (locale === 'en') return (st.name_en || st.name_pt || st.name_zh || '').trim() || st.name_pt;
  return (st.name_pt || st.name_en || st.name_zh || '').trim() || st.name_pt;
}

export type StationTicketJobPayload = {
  order_id: string;
  batch_id: string;
  print_station_id: string;
  locale: 'zh' | 'en' | 'pt';
  station_display_name_pt: string;
  station_display_name_en: string | null;
  station_display_name_zh: string | null;
  table_id: string;
  display_name: string;
  guest_count?: number;
  order_time?: string;
  station_slip_options: {
    show_category_group: boolean;
  };
  lines: Array<{
    item_index: number;
    menu_item_id: string;
    qty: number;
    note?: string;
    item_code: string | null;
    item_name: string;
    /** Legacy fallback for older print agents. */
    display_name: string;
    emoji: string;
    category_group_sort: number;
    category_group_header: string;
  }>;
};

function stationTicketPayloadMatch(
  p: Record<string, unknown>,
  orderId: string,
  batchId: string,
  printStationId: string,
): boolean {
  return (
    p.order_id === orderId &&
    p.batch_id === batchId &&
    p.print_station_id === printStationId
  );
}

export type RestaurantEnqueueRow = {
  id: string;
  name?: string | null;
  print_locale: string | null;
};

/** Enqueue station_ticket jobs for one order batch (called after guest/waiter submit). */
export async function enqueueStationTicketsForOrder(params: {
  admin: SupabaseClient;
  restaurant: RestaurantEnqueueRow;
  orderId: string;
  batchId: string;
}): Promise<
  | {
      ok: true;
      batch_id: string;
      inserted: number;
      skipped_duplicates: number;
      station_names: string[];
    }
  | { ok: false; status: number; code: string; message?: string }
> {
  const { admin, restaurant, orderId, batchId } = params;
  const restaurantId = restaurant.id;
  const locale = (restaurant.print_locale || 'pt') as 'zh' | 'en' | 'pt';

  const { data: restaurantRow, error: rCfgErr } = await admin
    .from('restaurants')
    .select('print_agent_config')
    .eq('id', restaurantId)
    .maybeSingle();

  if (rCfgErr) {
    return { ok: false, status: 500, code: 'restaurant_lookup_failed', message: rCfgErr.message };
  }

  const showCategoryGroup = isStationSlipShowCategoryGroupEnabled(restaurantRow?.print_agent_config);

  const { data: order, error: oErr } = await admin
    .from('orders')
    .select('id, restaurant_id, table_id, display_name, status, items, session_id, created_at, updated_at')
    .eq('id', orderId)
    .maybeSingle();

  if (oErr || !order || order.restaurant_id !== restaurantId) {
    return { ok: false, status: 404, code: 'order_not_found' };
  }

  const items = (order.items || []) as OrderItem[];
  const orderStatus = order.status as 'pending' | 'cooking' | 'done';

  const kitchenLines: { idx: number; item: OrderItem; batch: string }[] = [];
  items.forEach((item, idx) => {
    if (isBuffetBaseItem(item)) return;
    const st = normalizeOrderItemStatus(item, orderStatus);
    if (st === 'voided') return;
    if (!isUuid(item.id)) return;
    kitchenLines.push({ idx, item, batch: orderItemBatchKey(item) });
  });

  if (kitchenLines.length === 0) {
    return { ok: false, status: 400, code: 'no_printable_lines' };
  }

  const batchKnown = kitchenLines.some((l) => l.batch === batchId);
  if (!batchKnown) {
    return { ok: false, status: 400, code: 'unknown_batch' };
  }

  const menuIds = Array.from(new Set(kitchenLines.map((l) => l.item.id)));
  const [{ data: menuRows, error: mErr }, { data: categoryRows, error: cErr }] = await Promise.all([
    admin
      .from('menu_items')
      .select('id, category_id, print_station_id, item_code')
      .eq('restaurant_id', restaurantId)
      .in('id', menuIds),
    admin
      .from('menu_categories')
      .select('id, parent_id, print_station_id, item_code, name_pt, name_en, name_zh, sort_order')
      .eq('restaurant_id', restaurantId),
  ]);

  if (mErr || cErr) {
    return {
      ok: false,
      status: 500,
      code: 'menu_lookup_failed',
      message: mErr?.message || cErr?.message,
    };
  }

  type CategoryRow = MenuCategoryForStationTicket & { print_station_id: string | null };
  const categoryList = (categoryRows || []) as CategoryRow[];
  const categoryById = new Map(categoryList.map((c) => [c.id, c]));

  const menuById = new Map<string, MenuItemForPrint>();
  for (const row of menuRows || []) {
    const r = row as MenuItemForPrint & { print_station_id?: string | null };
    menuById.set(r.id, {
      id: r.id,
      category_id: r.category_id,
      item_code: r.item_code ?? null,
    });
  }

  function categoryGroupForMenuItem(menuItemId: string): {
    sort: number;
    header: string;
  } {
    const row = menuById.get(menuItemId);
    const topId = topLevelCategoryId(row?.category_id ?? null, categoryList);
    const top = topId ? categoryById.get(topId) : null;
    if (!top) {
      return { sort: 9999, header: '' };
    }
    return {
      sort: top.sort_order ?? 0,
      header: formatTopCategoryTicketHeader(top, locale),
    };
  }

  const resolveMap = new Map<string, string | null>();
  for (const row of menuRows || []) {
    const r = row as {
      id: string;
      category_id: string | null;
      print_station_id: string | null;
    };
    const eff = resolveEffectivePrintStationId(
      r.print_station_id,
      r.category_id,
      categoryList,
    );
    resolveMap.set(r.id, eff);
  }

  const linesInBatch = kitchenLines
    .filter((l) => l.batch === batchId)
    .map((l) => ({ ...l, station_id: resolveMap.get(l.item.id) ?? null }))
    .filter((l) => l.station_id);

  if (linesInBatch.length === 0) {
    return { ok: false, status: 400, code: 'no_station_bound_lines' };
  }

  const stationIds = Array.from(new Set(linesInBatch.map((l) => l.station_id as string)));

  let tableOrders: Array<{
    status: 'pending' | 'cooking' | 'done';
    items: OrderItem[];
    created_at: string;
    updated_at: string;
  }> = [
    {
      status: order.status as 'pending' | 'cooking' | 'done',
      items,
      created_at: order.created_at as string,
      updated_at: order.updated_at as string,
    },
  ];
  const sessionId = order.session_id as string | null | undefined;
  if (sessionId) {
    const { data: sessionOrderRows, error: soErr } = await admin
      .from('orders')
      .select('status, items, created_at, updated_at')
      .eq('restaurant_id', restaurantId)
      .eq('session_id', sessionId);
    if (soErr) {
      return { ok: false, status: 500, code: 'session_orders_lookup_failed', message: soErr.message };
    }
    if (sessionOrderRows?.length) {
      tableOrders = sessionOrderRows as typeof tableOrders;
    }
  } else {
    const { data: activeSession } = await admin
      .from('table_sessions')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .eq('table_id', order.table_id)
      .in('status', ['open', 'billing'])
      .maybeSingle();
    if (activeSession?.id) {
      const { data: sessionOrderRows, error: soErr } = await admin
        .from('orders')
        .select('status, items, created_at, updated_at')
        .eq('restaurant_id', restaurantId)
        .eq('session_id', activeSession.id);
      if (soErr) {
        return { ok: false, status: 500, code: 'session_orders_lookup_failed', message: soErr.message };
      }
      if (sessionOrderRows?.length) {
        tableOrders = sessionOrderRows as typeof tableOrders;
      }
    }
  }

  const guestCount = guestCountFromTableOrders(tableOrders);
  const orderTimeIso = stationTicketOrderTimeIso(
    items,
    batchId,
    (order.created_at as string) || new Date().toISOString(),
  );
  const orderTime = formatStationTicketOrderTime(orderTimeIso);

  const { data: existingJobs, error: jErr } = await admin
    .from('print_jobs')
    .select('status, payload')
    .eq('restaurant_id', restaurantId)
    .eq('type', 'station_ticket')
    .contains('payload', { order_id: orderId, batch_id: batchId });

  if (jErr) {
    return { ok: false, status: 500, code: 'jobs_lookup_failed', message: jErr.message };
  }

  const hasPendingDuplicate = (printStationId: string) =>
    (existingJobs || []).some(
      (j) =>
        ['pending', 'processing'].includes((j as { status: string }).status) &&
        stationTicketPayloadMatch(
          (j as { payload: Record<string, unknown> }).payload,
          orderId,
          batchId,
          printStationId,
        ),
    );

  const { data: stations, error: sErr } = await admin
    .from('print_stations')
    .select('id, name_pt, name_en, name_zh')
    .eq('restaurant_id', restaurantId)
    .in('id', stationIds);

  if (sErr || !stations?.length) {
    return { ok: false, status: 500, code: 'stations_lookup_failed', message: sErr?.message };
  }

  const stationById = new Map(stations.map((s) => [s.id, s as StationRow]));

  let inserted = 0;
  let skipped_duplicates = 0;
  const stationNames: string[] = [];

  for (const sid of stationIds) {
    if (hasPendingDuplicate(sid)) {
      skipped_duplicates += 1;
      continue;
    }

    const stMeta = stationById.get(sid);
    if (!stMeta) continue;

    const stationLines = linesInBatch.filter((l) => l.station_id === sid);
    const payload: StationTicketJobPayload = {
      order_id: orderId,
      batch_id: batchId,
      print_station_id: sid,
      locale,
      station_display_name_pt: stMeta.name_pt,
      station_display_name_en: stMeta.name_en,
      station_display_name_zh: stMeta.name_zh,
      table_id: order.table_id as string,
      display_name: (order.display_name as string) || '',
      station_slip_options: { show_category_group: showCategoryGroup },
      ...(guestCount > 0 ? { guest_count: guestCount } : {}),
      ...(orderTime ? { order_time: orderTime } : {}),
      lines: stationLines.map((l) => {
        const group = categoryGroupForMenuItem(l.item.id);
        const itemName = orderItemBaseName(l.item);
        const slipLabel = orderItemStationSlipLabel(l.item);
        return {
          item_index: l.idx,
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
    stationNames.push(stationLabelForLocale(stMeta, locale));
  }

  if (inserted === 0) {
    return {
      ok: false,
      status: 409,
      code: 'nothing_enqueued',
      message:
        skipped_duplicates > 0
          ? 'Station ticket tasks may already be pending for this batch.'
          : 'No station tickets to enqueue for this batch.',
    };
  }

  return {
    ok: true,
    batch_id: batchId,
    inserted,
    skipped_duplicates,
    station_names: stationNames,
  };
}
