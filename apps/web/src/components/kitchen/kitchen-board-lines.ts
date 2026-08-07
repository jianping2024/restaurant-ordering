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

export function lineSelectionKey(orderId: string, itemIndex: number): string {
  return `${orderId}:${itemIndex}`;
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
      const stored = item.item_status;
      const selectable =
        effectiveStatus === 'pending' ||
        stored === 'pending' ||
        stored === 'cooking' ||
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
        selectable: selectable && (effectiveStatus === 'pending' || effectiveStatus === 'cooking' || effectiveStatus === 'ready'),
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

/** Total open qty for same menu_item_id on this station board. */
export function stationDishTotalQty(
  lines: KitchenBoardLine[],
  menuItemId: string,
): number {
  return lines
    .filter((l) => l.menuItemId === menuItemId)
    .reduce((sum, l) => sum + (Number(l.item.qty) || 0), 0);
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
