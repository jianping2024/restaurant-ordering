import type { Buffet, Order, OrderItem } from '@/types';
import { isBuffetBaseItem } from '@/lib/order-items';
import { tableIdsEqual } from '@/lib/restaurant-tables';
import { normalizeOrderItemStatus } from '@/lib/order-status';

export function stripBuffetBaseLines(items: OrderItem[]): OrderItem[] {
  return items.filter((i) => !isBuffetBaseItem(i));
}

/** Mark active buffet_base lines void (keeps history for merge/audit). */
export function voidActiveBuffetBaseLines(items: OrderItem[]): OrderItem[] {
  const voidedAt = new Date().toISOString();
  return items.map((item) => {
    if (!isBuffetBaseItem(item)) return item;
    if (item.item_status === 'voided') return item;
    return { ...item, item_status: 'voided' as const, voided_at: voidedAt };
  });
}

/** Active (non-voided) buffet_base lines on a table's orders. */
export function activeBuffetBaseLinesForTable(orders: Order[], tableId: string): OrderItem[] {
  const lines: OrderItem[] = [];
  for (const order of orders) {
    if (!tableIdsEqual(order.table_id, tableId)) continue;
    for (const item of order.items) {
      if (!isBuffetBaseItem(item)) continue;
      if (normalizeOrderItemStatus(item, order.status) === 'voided') continue;
      lines.push(item);
    }
  }
  return lines;
}

/** One display row: sum headcounts; amount from active lines (post-merge usually one line). */
export function aggregateBuffetForTable(
  orders: Order[],
  tableId: string,
): { buffetId: string; name: string; adults: number; children: number; amount: number } | null {
  const active = activeBuffetBaseLinesForTable(orders, tableId);
  if (active.length === 0) return null;

  const buffetIds = new Set(active.map((l) => l.buffet_id).filter(Boolean) as string[]);
  if (buffetIds.size > 1) return null;

  const buffetId = active[0].buffet_id as string;
  let adults = 0;
  let children = 0;
  let amount = 0;
  const name = active[0].name || active[0].name_pt || 'Buffet';

  for (const line of active) {
    adults += line.adult_count ?? 0;
    children += line.child_count ?? 0;
    amount += line.price * (line.qty ?? 1);
  }

  return { buffetId, name, adults, children, amount };
}

export interface ResolvedBuffetPriceRow {
  adult_price: number | null;
  child_price: number | null;
  rule_id: string | null;
  time_slot_id: string | null;
}

export function buildBuffetBaseLine(params: {
  buffet: Pick<Buffet, 'id' | 'name'>;
  adultCount: number;
  childCount: number;
  resolved: ResolvedBuffetPriceRow;
}): OrderItem | null {
  const ap = params.resolved.adult_price;
  const cp = params.resolved.child_price;
  if (ap == null || cp == null) return null;
  const adults = Math.max(0, Math.floor(params.adultCount));
  const children = Math.max(0, Math.floor(params.childCount));
  if (adults + children <= 0) return null;

  const lineTotal = adults * Number(ap) + children * Number(cp);
  const addedAt = new Date().toISOString();

  return {
    id: `buffet:${params.buffet.id}`,
    kind: 'buffet_base',
    name: params.buffet.name,
    name_pt: params.buffet.name,
    qty: 1,
    price: lineTotal,
    emoji: '🍽️',
    item_status: 'done',
    buffet_id: params.buffet.id,
    adult_count: adults,
    child_count: children,
    adult_unit_price: Number(ap),
    child_unit_price: Number(cp),
    price_rule_id: params.resolved.rule_id || undefined,
    added_at: addedAt,
    batch_id: '__buffet__',
  };
}
