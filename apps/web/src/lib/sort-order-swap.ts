import type { SupabaseClient } from '@supabase/supabase-js';

export type SortOrderSwapError = { error: string; message?: string; status: number };

type SortOrderTable = 'menu_items' | 'print_stations';

/** Swap sort_order between two tenant-scoped rows (two UPDATEs). */
export async function swapSortOrderInDatabase(
  admin: SupabaseClient,
  table: SortOrderTable,
  restaurantId: string,
  idA: string,
  idB: string,
  sortOrderA: number,
  sortOrderB: number,
): Promise<{ ok: true } | SortOrderSwapError> {
  const { error: e1 } = await admin
    .from(table)
    .update({ sort_order: sortOrderB })
    .eq('id', idA)
    .eq('restaurant_id', restaurantId);
  if (e1) {
    return { error: 'update_failed', message: e1.message, status: 500 };
  }

  const { error: e2 } = await admin
    .from(table)
    .update({ sort_order: sortOrderA })
    .eq('id', idB)
    .eq('restaurant_id', restaurantId);
  if (e2) {
    return { error: 'update_failed', message: e2.message, status: 500 };
  }

  return { ok: true };
}
