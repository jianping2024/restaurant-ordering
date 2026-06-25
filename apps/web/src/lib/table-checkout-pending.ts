import type { SupabaseClient } from '@supabase/supabase-js';
import { tableIdsEqual } from '@/lib/restaurant-tables';

export type CheckoutRequestedRow = {
  table_id?: string | null;
  created_at?: string | null;
};

export function checkoutRequestedTableIdsFromRows(
  rows: Array<Pick<CheckoutRequestedRow, 'table_id'>>,
): string[] {
  return Array.from(
    new Set(
      rows
        .map((row) => row.table_id)
        .filter((tableId): tableId is string => typeof tableId === 'string' && tableId.length > 0),
    ),
  );
}

export function isTableCheckoutRequested(
  tableId: string,
  checkoutRequestedTableIds: readonly string[],
): boolean {
  return checkoutRequestedTableIds.some((id) => tableIdsEqual(id, tableId));
}

export function checkoutRequestedAtByTableIdFromRows(
  rows: CheckoutRequestedRow[],
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const row of rows) {
    const tableId = row.table_id;
    const createdAt = row.created_at;
    if (typeof tableId !== 'string' || !tableId || typeof createdAt !== 'string' || !createdAt) {
      continue;
    }
    const prev = map[tableId];
    if (!prev || createdAt > prev) map[tableId] = createdAt;
  }
  return map;
}

export function checkoutRequestedAtForTable(
  tableId: string,
  checkoutRequestedAtByTableId: Record<string, string>,
): string | null {
  if (checkoutRequestedAtByTableId[tableId]) return checkoutRequestedAtByTableId[tableId];
  const match = Object.entries(checkoutRequestedAtByTableId).find(([id]) =>
    tableIdsEqual(id, tableId),
  );
  return match?.[1] ?? null;
}

export async function fetchCheckoutRequestedBoard(
  client: SupabaseClient,
  restaurantId: string,
): Promise<{ tableIds: string[]; atByTableId: Record<string, string> }> {
  const { data } = await client
    .from('bill_splits')
    .select('table_id, created_at')
    .eq('restaurant_id', restaurantId)
    .eq('status', 'requested')
    .not('session_id', 'is', null);

  const rows = data || [];
  return {
    tableIds: checkoutRequestedTableIdsFromRows(rows),
    atByTableId: checkoutRequestedAtByTableIdFromRows(rows),
  };
}

export async function fetchCheckoutRequestedTableIds(
  client: SupabaseClient,
  restaurantId: string,
): Promise<string[]> {
  const { tableIds } = await fetchCheckoutRequestedBoard(client, restaurantId);
  return tableIds;
}
