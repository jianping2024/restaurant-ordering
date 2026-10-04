import type { Order, OrderItem, OrderItemStatus } from '@/types';
import { isBuffetBaseItem } from '@/lib/order-items';
import {
  effectiveItemStatus,
  isKitchenBoardOpenStatus,
} from '@/lib/order-status';
import { formatOnScreenMenuItemLabel, resolveMenuItemLocalizedName } from '@/lib/menu-item-display';
import { resolveMenuItemCode } from '@/lib/menu-item-code';
import type { UILanguage } from '@/lib/i18n';

export type KitchenBoardLine = {
  key: string;
  orderId: string;
  itemIndex: number;
  order: Order;
  item: OrderItem;
  tableId: string;
  tableDisplay: string;
  menuItemId: string;
  /** Catalog/on-ticket item code snapshot (may be empty). */
  itemCode: string | null;
  /** Display name with optional code prefix — sole kitchen row title for the dish. */
  displayName: string;
  effectiveStatus: OrderItemStatus;
  /** Workbench: first prep only (pending). */
  prepEligible: boolean;
  /** Bottom rail: reprint only (cooking or display-ready). */
  printEligible: boolean;
  /** Ordered-at epoch ms (item.added_at || order.created_at). */
  orderedAtMs: number;
};

/** Workbench only: pending (not yet prepped). */
export function isKitchenWorkbenchStatus(status: OrderItemStatus): boolean {
  return status === 'pending';
}

/** Bottom rail: prepped (cooking) + display-ready. */
export function isKitchenBottomRailStatus(status: OrderItemStatus): boolean {
  return status === 'cooking' || status === 'ready';
}

export function lineSelectionKey(orderId: string, itemIndex: number): string {
  return `${orderId}:${itemIndex}`;
}

export function lineNoteKey(item: OrderItem): string {
  return (item.note || '').trim();
}

export function lineOrderedAtMs(order: Order, item: OrderItem): number {
  const raw = item.added_at || order.created_at;
  const ms = new Date(raw).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

/** Whole minutes waited since ordered-at (floor, min 0). */
export function lineWaitMinutes(orderedAtMs: number, nowMs: number): number {
  if (!orderedAtMs) return 0;
  return Math.max(0, Math.floor((nowMs - orderedAtMs) / 60_000));
}

/** Lines for one station pane: open statuses, matching print_station_id. */
export function collectStationBoardLines(input: {
  orders: Order[];
  printStationId: string;
  nowMs: number;
  readyAfterMinutes: number;
  lang: UILanguage;
}): KitchenBoardLine[] {
  const lines: KitchenBoardLine[] = [];
  for (const order of input.orders) {
    const items = order.items || [];
    for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
      const item = items[itemIndex];
      if (!item || isBuffetBaseItem(item)) continue;
      if (item.print_station_id !== input.printStationId) continue;
      const effectiveStatus = effectiveItemStatus({
        item,
        orderStatus: order.status,
        nowMs: input.nowMs,
        readyAfterMinutes: input.readyAfterMinutes,
      });
      if (!isKitchenBoardOpenStatus(effectiveStatus)) continue;
      const prepEligible = effectiveStatus === 'pending';
      const printEligible =
        effectiveStatus === 'cooking' || effectiveStatus === 'ready';
      const name = resolveMenuItemLocalizedName(item, input.lang) || item.id;
      const itemCode = resolveMenuItemCode(item);
      lines.push({
        key: lineSelectionKey(order.id, itemIndex),
        orderId: order.id,
        itemIndex,
        order,
        item,
        tableId: order.table_id,
        tableDisplay: (order.display_name || '').trim() || order.table_id.slice(0, 8),
        menuItemId: item.id,
        itemCode,
        displayName: formatOnScreenMenuItemLabel(name, itemCode),
        effectiveStatus,
        prepEligible,
        printEligible,
        orderedAtMs: lineOrderedAtMs(order, item),
      });
    }
  }
  lines.sort((a, b) => a.orderedAtMs - b.orderedAtMs);
  return lines;
}

/** Split board lines into workbench vs bottom rail — one line belongs to exactly one. */
export function partitionStationLines(lines: KitchenBoardLine[]): {
  workbench: KitchenBoardLine[];
  bottomRail: KitchenBoardLine[];
} {
  const workbench: KitchenBoardLine[] = [];
  const bottomRail: KitchenBoardLine[] = [];
  for (const line of lines) {
    if (isKitchenBottomRailStatus(line.effectiveStatus)) bottomRail.push(line);
    else if (isKitchenWorkbenchStatus(line.effectiveStatus)) workbench.push(line);
  }
  return { workbench, bottomRail };
}

/**
 * Sole bottom-rail status groups (display only; partition already put cooking+ready here).
 * Cooking first, then ready — preserves relative order within each group.
 */
export function groupBottomRailByStatus(lines: KitchenBoardLine[]): {
  cooking: KitchenBoardLine[];
  ready: KitchenBoardLine[];
} {
  const cooking: KitchenBoardLine[] = [];
  const ready: KitchenBoardLine[] = [];
  for (const line of lines) {
    if (line.effectiveStatus === 'ready') ready.push(line);
    else if (line.effectiveStatus === 'cooking') cooking.push(line);
  }
  return { cooking, ready };
}

export function sumLineQty(lines: KitchenBoardLine[]): number {
  return lines.reduce((sum, l) => sum + (Number(l.item.qty) || 0), 0);
}

export type DishAggregate = {
  menuItemId: string;
  name: string;
  /** Workbench portion total for this dish (qty sum; not order-line count). */
  totalQty: number;
  /** Order lines for by-dish L2 list + group select / prep (no L1 table-summary fields). */
  lines: KitchenBoardLine[];
};

/** Group workbench lines by dish; portion total for L1, lines for L2 (no L1 table summary). */
export function aggregateLinesByDish(lines: KitchenBoardLine[]): DishAggregate[] {
  const byId = new Map<string, DishAggregate>();
  for (const line of lines) {
    let agg = byId.get(line.menuItemId);
    if (!agg) {
      agg = {
        menuItemId: line.menuItemId,
        name: line.displayName,
        totalQty: 0,
        lines: [],
      };
      byId.set(line.menuItemId, agg);
    }
    agg.totalQty += Number(line.item.qty) || 0;
    agg.lines.push(line);
  }
  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function groupLinesByTable(lines: KitchenBoardLine[]): Array<{
  tableId: string;
  tableDisplay: string;
  lines: KitchenBoardLine[];
}> {
  const byTable = new Map<string, { tableId: string; tableDisplay: string; lines: KitchenBoardLine[] }>();
  for (const line of lines) {
    let g = byTable.get(line.tableId);
    if (!g) {
      g = { tableId: line.tableId, tableDisplay: line.tableDisplay, lines: [] };
      byTable.set(line.tableId, g);
    }
    g.lines.push(line);
  }
  return Array.from(byTable.values());
}

/** Workbench group header badge + tri-state: order lines only (never qty / table count). */
export type GroupSelectionFrac = {
  selected: number;
  total: number;
  state: 'none' | 'partial' | 'all';
};

/**
 * Sole workbench group selection tally for by-table / by-dish headers.
 * `total` = prepEligible lines in the group; `selected` = those also in `selectedKeys`.
 */
export function groupSelectionFrac(
  lines: readonly KitchenBoardLine[],
  selectedKeys: ReadonlySet<string>,
): GroupSelectionFrac {
  let total = 0;
  let selected = 0;
  for (const line of lines) {
    if (!line.prepEligible) continue;
    total += 1;
    if (selectedKeys.has(line.key)) selected += 1;
  }
  const state: GroupSelectionFrac['state'] =
    total === 0 || selected === 0 ? 'none' : selected >= total ? 'all' : 'partial';
  return { selected, total, state };
}

/** Sole workbench group select-all toggle (prepEligible lines only). */
export function toggleGroupPrepSelection(
  lines: readonly KitchenBoardLine[],
  prev: ReadonlySet<string>,
): Set<string> {
  const next = new Set(prev);
  const { state } = groupSelectionFrac(lines, prev);
  const clear = state === 'all';
  for (const line of lines) {
    if (!line.prepEligible) continue;
    if (clear) next.delete(line.key);
    else next.add(line.key);
  }
  return next;
}
