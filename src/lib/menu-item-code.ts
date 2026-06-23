import type { OrderItem } from '@/types';

export function resolveMenuItemCode(
  item: Pick<OrderItem, 'id' | 'item_code'>,
  lookup: Record<string, string> = {},
): string | null {
  const fromLine = item.item_code?.trim();
  if (fromLine) return fromLine;
  return lookup[item.id]?.trim() || null;
}

export function menuItemCodeLookupFromRows(
  rows: Array<{ id: string; item_code?: string | null }>,
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const row of rows) {
    const code = row.item_code?.trim();
    if (code) map[row.id] = code;
  }
  return map;
}

/** Distinct menu line ids on session orders (excludes buffet_base synthetic lines). */
export function distinctMenuItemIdsFromOrders(
  orders: Array<{ items?: OrderItem[] }>,
): string[] {
  return Array.from(
    new Set(
      orders.flatMap((order) =>
        (order.items || [])
          .filter((item) => item.kind !== 'buffet_base')
          .map((item) => item.id),
      ),
    ),
  );
}
