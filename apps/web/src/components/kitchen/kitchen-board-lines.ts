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

export function sumLineQty(lines: KitchenBoardLine[]): number {
  return lines.reduce((sum, l) => sum + (Number(l.item.qty) || 0), 0);
}

export type DishAggregate = {
  menuItemId: string;
  name: string;
  /** Workbench portion total for this dish (not table count). */
  totalQty: number;
  /** Distinct tables with this dish on the workbench. */
  tableCount: number;
  tableDisplays: string[];
  lines: KitchenBoardLine[];
};

/** Group workbench lines by dish; tableDisplays / tableCount are unique by tableId. */
export function aggregateLinesByDish(lines: KitchenBoardLine[]): DishAggregate[] {
  type Acc = {
    menuItemId: string;
    name: string;
    totalQty: number;
    tableDisplays: string[];
    lines: KitchenBoardLine[];
    tableIds: Set<string>;
  };
  const byId = new Map<string, Acc>();
  for (const line of lines) {
    let agg = byId.get(line.menuItemId);
    if (!agg) {
      agg = {
        menuItemId: line.menuItemId,
        name: line.displayName,
        totalQty: 0,
        tableDisplays: [],
        lines: [],
        tableIds: new Set(),
      };
      byId.set(line.menuItemId, agg);
    }
    agg.totalQty += Number(line.item.qty) || 0;
    agg.lines.push(line);
    if (!agg.tableIds.has(line.tableId)) {
      agg.tableIds.add(line.tableId);
      agg.tableDisplays.push(line.tableDisplay);
    }
  }
  return Array.from(byId.values())
    .map((agg) => ({
      menuItemId: agg.menuItemId,
      name: agg.name,
      totalQty: agg.totalQty,
      tableCount: agg.tableDisplays.length,
      tableDisplays: agg.tableDisplays,
      lines: agg.lines,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
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
