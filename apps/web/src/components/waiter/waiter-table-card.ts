import type { Order, OrderItem } from '@/types';
import {
  billableCatalogLineAnchorAt,
  billableMenuItemMergeKey,
  chargeableFieldsFromBillableRow,
  limitedBillableMergeKey,
  sortBillableSessionItemsForWaiterDetail,
  sortOrdersForBillableCatalog,
  sumBillableMenuCatalogQty,
  sumBillableNonBuffetTotal,
  sumBillableSessionTotal,
  type BillableSessionItem,
} from '@/lib/billable-session-lines';
import { allocateSessionSushiLimitedLines, sushiLimitedLineKey } from '@/lib/sushi-buffet-limits';
import {
  activeBuffetLineByBuffetId,
  aggregateBuffetHeadcountForOrders,
  listActiveBuffetLineSummaries,
  type BuffetGuestHeadcount,
} from '@/lib/buffet-order';
import { resolveMenuItemLocalizedName } from '@/lib/menu-item-display';
import {
  formatStaffBuffetLineLabel,
  formatOrderItemQuantityLabel,
} from '@/lib/order-list-display';
import { canDecrementOrderLine } from '@/lib/order-item-decrement/decrement-policy';
import { can, type Capabilities } from '@/lib/permissions/can';
import { normalizeOrderItemStatus, effectiveItemStatus } from '@/lib/order-status';
import { isBuffetBaseItem, isKitchenRemakeItem, isMenuCatalogItem } from '@/lib/order-items';
import { resolveMenuItemCode } from '@/lib/menu-item-code';
import { KITCHEN_READY_AFTER_MINUTES_DEFAULT } from '@/lib/print-agent-config';
import { DEFAULT_UI_LANG, type UILanguage } from '@/lib/i18n';
import {
  resolveKitchenItemProgressLabel,
  shouldShowKitchenItemProgress,
} from '@/lib/kitchen-progress-display';

/** Separates billable base key from wire note in waiter「已点」display keys. */
const WAITER_ORDERED_NOTE_SEP = '\u001f';

export function normalizeWaiterOrderedLineNote(note: unknown): string {
  return typeof note === 'string' ? note.trim() : '';
}

/**
 * Waiter detail list merge: same billable dish (+ limited) + same note → one row.
 * Money/session totals still use {@link buildBillableSessionItems} (notes ignored).
 */
export function waiterOrderedDisplayMergeKey(item: OrderItem, limited: boolean): string {
  const base = limited ? limitedBillableMergeKey(item.id) : billableMenuItemMergeKey(item);
  return `${base}${WAITER_ORDERED_NOTE_SEP}${normalizeWaiterOrderedLineNote(item.note)}`;
}

export type WaiterOrderLine = {
  /**
   * Display merge key (`menuId::price` / `limited:id` + note sep + trimmed note).
   * Not the same as paper billable merge when notes differ.
   */
  catalogKey: string;
  orderId: string;
  itemIdx: number;
  /** Menu item code prefix (`018`); null when missing. */
  itemCode: string | null;
  /** Dish name only (no item code — code is `itemCode`). Buffet headcount is not a list line. */
  label: string;
  /** Wire note (choice labels + presets + free text); null when empty. */
  note: string | null;
  /** Menu line unit price from order `item.price` (shown after name). */
  unitPrice: number | null;
  /** Kitchen-enabled station progress (effective status); null for non-kitchen lines. */
  statusLabel: string | null;
  /** Menu lines: `× N` shown beside the decrement control. */
  quantityLabel: string | null;
  canDecrement: boolean;
  /** Feature + capability + kitchen station gate + effective ready. */
  canServe: boolean;
  serveOrderId: string | null;
  serveItemIdx: number | null;
  /** Sushi limited dish: chargeable share of this row (null when fully included). */
  chargeableQty: number | null;
  chargeableUnitPrice: number | null;
};

export interface WaiterTableCardData {
  tableId: string;
  displayName: string;
  /** Dish rows only — buffet headcount lives in `buffetOrderedTitle`. */
  orderLines: WaiterOrderLine[];
  hasBuffet: boolean;
  buffetHeadcount: BuffetGuestHeadcount | null;
  /**
   * Sole buffet package label(s) for ordered-items title (`Buffet livre · A2`).
   * Null when no active buffet_base.
   */
  buffetOrderedTitle: string | null;
  sessionTotal: number;
  /** Non-buffet billable total for ordered-items money chrome (饮食). */
  mealsTotal: number;
  /** Sole dish-portion count for floor card meta (`×N`); menu catalog only. */
  orderedDishQty: number;
  updatedAt: string;
}

/** Sole title suffix for active buffet packages on waiter detail ordered list. */
export function formatWaiterOrderedBuffetTitle(
  orders: Order[],
  lang: UILanguage,
): string | null {
  const lines = Array.from(activeBuffetLineByBuffetId(orders).values());
  if (lines.length === 0) return null;
  return lines
    .map((item) => formatStaffBuffetLineLabel(item, lang, { headcountStyle: 'receipt' }))
    .join(' · ');
}

type MenuLineActionTarget = Pick<
  WaiterOrderLine,
  'orderId' | 'itemIdx' | 'canDecrement' | 'canServe' | 'serveOrderId' | 'serveItemIdx'
>;

type MenuLineCandidate = {
  orderId: string;
  itemIdx: number;
  item: OrderItem;
  order: Order;
};

/**
 * Pick the physical order line for decrement on a billable merge group.
 * Prefers a decrementable row with qty > 1 (avoids void-reason dialog), then any
 * decrementable row, then the first matching active row (display-only pointer).
 */
function resolveMenuLineActionTarget(
  orders: Order[],
  mergeKey: string,
  capabilities: Capabilities,
  serveEnabled: boolean,
  readyAfterMinutes: number,
  nowMs: number,
  kitchenEnabledStationIds: readonly string[],
): MenuLineActionTarget {
  const match = (item: OrderItem) => {
    const limited = mergeKey.startsWith('limited:');
    return waiterOrderedDisplayMergeKey(item, limited) === mergeKey;
  };

  const base = pickMenuLineActionTarget(orders, capabilities, match);
  let canServe = false;
  let serveOrderId: string | null = null;
  let serveItemIdx: number | null = null;

  if (serveEnabled && can(capabilities, 'orders.serve_to_table')) {
    for (const order of orders) {
      const items = order.items || [];
      for (let itemIdx = 0; itemIdx < items.length; itemIdx += 1) {
        const item = items[itemIdx];
        if (!item || !isMenuCatalogItem(item)) continue;
        if (!match(item)) continue;
        if (
          !shouldShowKitchenItemProgress({
            printStationIds: item.print_station_ids,
            printStationId: item.print_station_id,
            kitchenEnabledStationIds,
            item,
          })
        ) {
          continue;
        }
        const effective = effectiveItemStatus({
          item,
          orderStatus: order.status,
          nowMs,
          readyAfterMinutes,
        });
        if (effective === 'ready') {
          canServe = true;
          serveOrderId = order.id;
          serveItemIdx = itemIdx;
          break;
        }
      }
      if (canServe) break;
    }
  }

  return {
    orderId: base.orderId,
    itemIdx: base.itemIdx,
    canDecrement: base.canDecrement,
    canServe,
    serveOrderId,
    serveItemIdx,
  };
}

function pickMenuLineActionTarget(
  orders: Order[],
  capabilities: Capabilities,
  match: (item: OrderItem) => boolean,
): Pick<WaiterOrderLine, 'orderId' | 'itemIdx' | 'canDecrement'> {
  let fallback: MenuLineCandidate | null = null;
  let bestDecrementable: MenuLineCandidate | null = null;
  let bestQtyGt1: MenuLineCandidate | null = null;

  for (const order of orders) {
    const items = order.items || [];
    for (let itemIdx = 0; itemIdx < items.length; itemIdx += 1) {
      const item = items[itemIdx];
      if (!item || isBuffetBaseItem(item)) continue;
      if (normalizeOrderItemStatus(item, order.status) === 'voided') continue;
      if (!match(item)) continue;

      const loc: MenuLineCandidate = { orderId: order.id, itemIdx, item, order };
      if (!fallback) fallback = loc;

      if (!canDecrementOrderLine(capabilities, item, order.status)) continue;
      if (!bestDecrementable) bestDecrementable = loc;
      if (item.qty > 1 && !bestQtyGt1) bestQtyGt1 = loc;
    }
  }

  const chosen = bestQtyGt1 ?? bestDecrementable ?? fallback;
  if (!chosen) {
    return { orderId: '', itemIdx: -1, canDecrement: false };
  }

  return {
    orderId: chosen.orderId,
    itemIdx: chosen.itemIdx,
    canDecrement: canDecrementOrderLine(capabilities, chosen.item, chosen.order.status),
  };
}

function latestOrderTimestamp(orders: Order[]): string {
  let latest = '';
  for (const order of orders) {
    const ts = order.updated_at || order.created_at;
    if (ts && (!latest || ts > latest)) latest = ts;
  }
  return latest;
}

type WaiterDisplayMergeGroup = {
  item: OrderItem;
  qty: number;
  chargeableQty: number;
  chargeableUnitPrice: number | null;
};

/**
 * Waiter「已点」display rows: merge same dish+price(+limited) only when note matches.
 * Session money still uses billable catalog (notes ignored there).
 */
function buildWaiterOrderedDisplayItems(orders: Order[]): BillableSessionItem[] {
  const catalogOrders = sortOrdersForBillableCatalog(orders);
  const buffetSummaries = listActiveBuffetLineSummaries(orders);
  const limitAllocations = allocateSessionSushiLimitedLines(orders);
  const merged = new Map<string, WaiterDisplayMergeGroup>();
  const anchors = new Map<string, string>();

  for (const order of catalogOrders) {
    const items = order.items || [];
    for (let itemIdx = 0; itemIdx < items.length; itemIdx += 1) {
      const item = items[itemIdx];
      if (!item || isKitchenRemakeItem(item)) continue;
      if (normalizeOrderItemStatus(item, order.status) === 'voided') continue;
      if (isBuffetBaseItem(item) && buffetSummaries.length > 0) continue;

      const allocation = limitAllocations.get(sushiLimitedLineKey(order.id, itemIdx));
      const limited = Boolean(allocation);
      const key = waiterOrderedDisplayMergeKey(item, limited);
      const anchor = billableCatalogLineAnchorAt(order, itemIdx, item);
      const prevAnchor = anchors.get(key);
      if (prevAnchor == null || anchor < prevAnchor) anchors.set(key, anchor);

      const qty = Math.max(0, Number(item.qty) || 0);
      const existing = merged.get(key);
      if (existing) {
        existing.qty += qty;
        if (allocation) {
          existing.chargeableQty += allocation.chargeableQty;
          if (existing.chargeableUnitPrice == null) {
            existing.chargeableUnitPrice = allocation.chargeableUnitPrice;
          }
        }
        continue;
      }
      merged.set(key, {
        item,
        qty,
        chargeableQty: allocation?.chargeableQty ?? 0,
        chargeableUnitPrice: allocation?.chargeableUnitPrice ?? null,
      });
    }
  }

  const keys = Array.from(merged.keys()).sort((a, b) => {
    const anchorA = anchors.get(a) ?? a;
    const anchorB = anchors.get(b) ?? b;
    if (anchorA !== anchorB) return anchorA < anchorB ? -1 : 1;
    return a.localeCompare(b);
  });

  return keys.map((key) => {
    const group = merged.get(key)!;
    return {
      key,
      item: { ...group.item, qty: group.qty },
      ...chargeableFieldsFromBillableRow({
        chargeableQty: group.chargeableQty,
        chargeableUnitPrice: group.chargeableUnitPrice ?? undefined,
      }),
    };
  });
}

/** `orders` is already the table/session view (see ordersForWaiterTableView). */
export function buildWaiterTableCard(
  tableId: string,
  displayName: string,
  orders: Order[],
  itemCodeByMenuId: Record<string, string> = {},
  /** Board list summaries may omit this; decrement flags then stay false. */
  capabilities: Capabilities = new Set(),
  options: {
    serveEnabled?: boolean;
    readyAfterMinutes?: number;
    nowMs?: number;
    lang?: UILanguage;
    kitchenEnabledStationIds?: readonly string[];
    /** Sole within-band order for「已点」; empty → unknown ids after ranked (stable by key). */
    menuBrowseRankByItemId?: ReadonlyMap<string, number>;
  } = {},
): WaiterTableCardData {
  const buffetSummaries = listActiveBuffetLineSummaries(orders);
  const catalogOrders = sortOrdersForBillableCatalog(orders);
  const catalog = sortBillableSessionItemsForWaiterDetail(
    buildWaiterOrderedDisplayItems(catalogOrders),
    options.menuBrowseRankByItemId ?? new Map(),
  );
  const serveEnabled = options.serveEnabled === true;
  const readyAfterMinutes =
    options.readyAfterMinutes ?? KITCHEN_READY_AFTER_MINUTES_DEFAULT;
  const nowMs = options.nowMs ?? Date.now();
  const lang = options.lang ?? DEFAULT_UI_LANG;
  const kitchenEnabledStationIds = options.kitchenEnabledStationIds ?? [];

  const orderLines: WaiterOrderLine[] = catalog
    .filter((row) => !isBuffetBaseItem(row.item))
    .map((row) => {
      const { key, item } = row;
      const action = resolveMenuLineActionTarget(
        catalogOrders,
        key,
        capabilities,
        serveEnabled,
        readyAfterMinutes,
        nowMs,
        kitchenEnabledStationIds,
      );
      const share = chargeableFieldsFromBillableRow(row);
      const statusOrder =
        action.orderId !== '' ? orders.find((order) => order.id === action.orderId) : undefined;
      const statusItem =
        statusOrder && action.itemIdx >= 0
          ? statusOrder.items?.[action.itemIdx] ?? item
          : item;
      const statusLabel = resolveKitchenItemProgressLabel({
        lang,
        item: statusItem,
        orderStatus: statusOrder?.status ?? 'pending',
        nowMs,
        readyAfterMinutes,
        printStationIds: statusItem.print_station_ids,
        printStationId: statusItem.print_station_id,
        kitchenEnabledStationIds,
      });
      const note = normalizeWaiterOrderedLineNote(item.note);

      return {
        catalogKey: row.key,
        ...action,
        itemCode: resolveMenuItemCode(item, itemCodeByMenuId),
        label: resolveMenuItemLocalizedName(item, lang),
        note: note.length > 0 ? note : null,
        unitPrice: Number.isFinite(Number(item.price)) ? Number(item.price) : null,
        statusLabel,
        quantityLabel: formatOrderItemQuantityLabel(item, { headcountStyle: 'receipt' }),
        chargeableQty: share.chargeableQty ?? null,
        chargeableUnitPrice: share.chargeableUnitPrice ?? null,
      };
    });

  return {
    tableId,
    displayName,
    orderLines,
    hasBuffet: buffetSummaries.length > 0,
    buffetHeadcount: aggregateBuffetHeadcountForOrders(orders),
    buffetOrderedTitle: formatWaiterOrderedBuffetTitle(orders, lang),
    sessionTotal: sumBillableSessionTotal(orders),
    mealsTotal: sumBillableNonBuffetTotal(orders),
    orderedDishQty: sumBillableMenuCatalogQty(orders),
    updatedAt: latestOrderTimestamp(orders),
  };
}
