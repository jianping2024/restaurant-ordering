import type { Order, OrderItem, OrderItemStatus } from '@/types';
import { isBuffetBaseItem } from '@/lib/order-items';
import {
  effectiveItemStatus,
  isKitchenBoardOpenStatus,
} from '@/lib/order-status';

export type KitchenBoardLine = {
  key: string;
  orderId: string;
  itemIndex: number;
  order: Order;
  item: OrderItem;
  tableId: string;
  tableDisplay: string;
  menuItemId: string;
  effectiveStatus: OrderItemStatus;
  selectable: boolean;
};

/** Workbench only: pending + still-cooking (not yet display-ready). */
export function isKitchenWorkbenchStatus(status: OrderItemStatus): boolean {
  return status === 'pending' || status === 'cooking';
}

/** Ready rail only: effective ready (auto 已出餐 display). */
export function isKitchenReadyRailStatus(status: OrderItemStatus): boolean {
  return status === 'ready';
}

export function lineSelectionKey(orderId: string, itemIndex: number): string {
  return `${orderId}:${itemIndex}`;
}

export function lineNoteKey(item: OrderItem): string {
  return (item.note || '').trim();
}

/** Lines for one station pane: open statuses, matching print_station_id. */
export function collectStationBoardLines(input: {
  orders: Order[];
  printStationId: string;
  nowMs: number;
  readyAfterMinutes: number;
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
      const selectable =
        effectiveStatus === 'pending' ||
        effectiveStatus === 'cooking' ||
        effectiveStatus === 'ready';
      lines.push({
        key: lineSelectionKey(order.id, itemIndex),
        orderId: order.id,
        itemIndex,
        order,
        item,
        tableId: order.table_id,
        tableDisplay: (order.display_name || '').trim() || order.table_id.slice(0, 8),
        menuItemId: item.id,
        effectiveStatus,
        selectable,
      });
    }
  }
  lines.sort((a, b) => {
    const ta = new Date(a.item.added_at || a.order.created_at).getTime();
    const tb = new Date(b.item.added_at || b.order.created_at).getTime();
    return ta - tb;
  });
  return lines;
}

/** Split board lines into workbench vs 已出餐 rail — one line belongs to exactly one. */
export function partitionStationLines(lines: KitchenBoardLine[]): {
  workbench: KitchenBoardLine[];
  ready: KitchenBoardLine[];
} {
  const workbench: KitchenBoardLine[] = [];
  const ready: KitchenBoardLine[] = [];
  for (const line of lines) {
    if (isKitchenReadyRailStatus(line.effectiveStatus)) ready.push(line);
    else if (isKitchenWorkbenchStatus(line.effectiveStatus)) workbench.push(line);
  }
  return { workbench, ready };
}

export function sumLineQty(lines: KitchenBoardLine[]): number {
  return lines.reduce((sum, l) => sum + (Number(l.item.qty) || 0), 0);
}

/** Total workbench qty for same menu_item_id (excludes ready rail). */
export function stationDishTotalQty(
  workbenchLines: KitchenBoardLine[],
  menuItemId: string,
): number {
  return sumLineQty(workbenchLines.filter((l) => l.menuItemId === menuItemId));
}

export type DishAggregate = {
  menuItemId: string;
  name: string;
  emoji: string;
  totalQty: number;
  tableDisplays: string[];
  lines: KitchenBoardLine[];
};

export function aggregateLinesByDish(lines: KitchenBoardLine[]): DishAggregate[] {
  const byId = new Map<string, DishAggregate>();
  for (const line of lines) {
    let agg = byId.get(line.menuItemId);
    if (!agg) {
      agg = {
        menuItemId: line.menuItemId,
        name: line.item.name || line.item.name_pt || line.menuItemId,
        emoji: line.item.emoji || '🍽️',
        totalQty: 0,
        tableDisplays: [],
        lines: [],
      };
      byId.set(line.menuItemId, agg);
    }
    agg.totalQty += Number(line.item.qty) || 0;
    agg.lines.push(line);
    if (!agg.tableDisplays.includes(line.tableDisplay)) {
      agg.tableDisplays.push(line.tableDisplay);
    }
  }
  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Same table + same dish + same effective status + same note → one UI row.
 * Selection maps to all underlying order lines (prep/reprint).
 */
export type AccumulatedTableRow = {
  key: string;
  menuItemId: string;
  name: string;
  tableId: string;
  tableDisplay: string;
  note: string;
  qty: number;
  effectiveStatus: OrderItemStatus;
  lineKeys: string[];
  lines: KitchenBoardLine[];
};

export function accumulateRowsByTableDishStatusNote(
  lines: KitchenBoardLine[],
): AccumulatedTableRow[] {
  const byKey = new Map<string, AccumulatedTableRow>();
  for (const line of lines) {
    const note = lineNoteKey(line.item);
    const key = `${line.menuItemId}\0${line.tableId}\0${line.effectiveStatus}\0${note}`;
    let row = byKey.get(key);
    if (!row) {
      row = {
        key,
        menuItemId: line.menuItemId,
        name: line.item.name || line.item.name_pt || line.menuItemId,
        tableId: line.tableId,
        tableDisplay: line.tableDisplay,
        note,
        qty: 0,
        effectiveStatus: line.effectiveStatus,
        lineKeys: [],
        lines: [],
      };
      byKey.set(key, row);
    }
    row.qty += Number(line.item.qty) || 0;
    row.lineKeys.push(line.key);
    row.lines.push(line);
  }
  return Array.from(byKey.values());
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
