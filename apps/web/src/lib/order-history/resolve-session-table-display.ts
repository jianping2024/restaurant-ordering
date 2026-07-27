import type { Order } from '@/types';

export type TableDisplayRow = {
  id: string;
  display_name: string;
};

/** Authoritative table label for order history — never fall back to table UUID. */
export function resolveSessionTableDisplayName(
  tableId: string,
  tableDisplayById: ReadonlyMap<string, string>,
  orders: Order[],
): string {
  const fromTable = tableDisplayById.get(tableId)?.trim();
  if (fromTable) return fromTable;

  const fromOrder = orders
    .find((order) => order.display_name?.trim())
    ?.display_name?.trim();
  if (fromOrder) return fromOrder;

  return '—';
}

export function tableDisplayNameMapFromRows(rows: TableDisplayRow[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of rows) {
    const name = row.display_name?.trim();
    if (name) map.set(row.id, name);
  }
  return map;
}
