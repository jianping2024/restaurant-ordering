import type { SupabaseClient } from '@supabase/supabase-js';
import { swapAdjacentSortOrders } from '@/lib/sort-order';

type SortOrderTable = 'menu_items' | 'print_stations' | 'restaurant_table_groups';

export async function persistAdjacentSortOrderSwap(
  admin: SupabaseClient,
  table: SortOrderTable,
  restaurantId: string,
  rowA: { id: string; sort_order: number },
  rowB: { id: string; sort_order: number },
): Promise<{ ok: true } | { error: 'update_failed'; message: string }> {
  const { sortOrderA, sortOrderB } = swapAdjacentSortOrders(rowA, rowB);

  const { error: e1 } = await admin
    .from(table)
    .update({ sort_order: sortOrderA })
    .eq('id', rowA.id)
    .eq('restaurant_id', restaurantId);
  if (e1) {
    return { error: 'update_failed', message: e1.message };
  }

  const { error: e2 } = await admin
    .from(table)
    .update({ sort_order: sortOrderB })
    .eq('id', rowB.id)
    .eq('restaurant_id', restaurantId);
  if (e2) {
    return { error: 'update_failed', message: e2.message };
  }

  return { ok: true };
}
