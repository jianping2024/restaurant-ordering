import type { SupabaseClient } from '@supabase/supabase-js';
import { tableIdsEqual } from '@/lib/restaurant-tables';

export function checkoutRequestedTableIdsFromRows(
  rows: Array<{ table_id?: string | null }>,
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

export async function fetchCheckoutRequestedTableIds(
  client: SupabaseClient,
  restaurantId: string,
): Promise<string[]> {
  const { data } = await client
    .from('bill_splits')
    .select('table_id')
    .eq('restaurant_id', restaurantId)
    .eq('status', 'requested')
    .not('session_id', 'is', null);

  return checkoutRequestedTableIdsFromRows(data || []);
}
