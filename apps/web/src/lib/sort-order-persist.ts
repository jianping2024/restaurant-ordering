import type { SupabaseClient } from '@supabase/supabase-js';
import { adjacentSortOrderSwapSteps } from '@/lib/sort-order';

type SortOrderTable = 'menu_items' | 'print_stations' | 'restaurant_table_groups';

/** Tables guarded by unique (restaurant_id, …, sort_order); swap needs a temp slot. */
const UNIQUE_SORT_ORDER_TABLES = new Set<SortOrderTable>(['menu_items']);

export async function persistAdjacentSortOrderSwap(
  admin: SupabaseClient,
  table: SortOrderTable,
  restaurantId: string,
  rowA: { id: string; sort_order: number },
  rowB: { id: string; sort_order: number },
  scopeMaxSortOrder: number,
): Promise<{ ok: true } | { error: 'update_failed'; message: string }> {
  const steps = adjacentSortOrderSwapSteps(rowA, rowB, scopeMaxSortOrder);
  if (!steps) {
    return { ok: true };
  }

  if (UNIQUE_SORT_ORDER_TABLES.has(table)) {
    const { tempOrder, finalSortOrderA, finalSortOrderB } = steps;

    const { error: e1 } = await admin
      .from(table)
      .update({ sort_order: tempOrder })
      .eq('id', rowA.id)
      .eq('restaurant_id', restaurantId);
    if (e1) {
      return { error: 'update_failed', message: e1.message };
    }

    const { error: e2 } = await admin
      .from(table)
      .update({ sort_order: finalSortOrderB })
      .eq('id', rowB.id)
      .eq('restaurant_id', restaurantId);
    if (e2) {
      return { error: 'update_failed', message: e2.message };
    }

    const { error: e3 } = await admin
      .from(table)
      .update({ sort_order: finalSortOrderA })
      .eq('id', rowA.id)
      .eq('restaurant_id', restaurantId);
    if (e3) {
      return { error: 'update_failed', message: e3.message };
    }

    return { ok: true };
  }

  const { finalSortOrderA, finalSortOrderB } = steps;
  const { error: e1 } = await admin
    .from(table)
    .update({ sort_order: finalSortOrderA })
    .eq('id', rowA.id)
    .eq('restaurant_id', restaurantId);
  if (e1) {
    return { error: 'update_failed', message: e1.message };
  }

  const { error: e2 } = await admin
    .from(table)
    .update({ sort_order: finalSortOrderB })
    .eq('id', rowB.id)
    .eq('restaurant_id', restaurantId);
  if (e2) {
    return { error: 'update_failed', message: e2.message };
  }

  return { ok: true };
}
