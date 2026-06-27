import type { SupabaseClient } from '@supabase/supabase-js';
import { adjacentSortOrderSwapSteps } from '@/lib/sort-order';

/** Persist adjacent swap for menu_items (unique index on category sort_order requires 3-step). */
export async function persistMenuItemSortOrderSwap(
  admin: SupabaseClient,
  restaurantId: string,
  rowA: { id: string; sort_order: number },
  rowB: { id: string; sort_order: number },
  scopeMaxSortOrder: number,
): Promise<{ ok: true } | { error: 'update_failed'; message: string }> {
  const steps = adjacentSortOrderSwapSteps(rowA, rowB, scopeMaxSortOrder);
  if (!steps) {
    return { ok: true };
  }

  const { tempOrder, finalSortOrderA, finalSortOrderB } = steps;

  const { error: e1 } = await admin
    .from('menu_items')
    .update({ sort_order: tempOrder })
    .eq('id', rowA.id)
    .eq('restaurant_id', restaurantId);
  if (e1) {
    return { error: 'update_failed', message: e1.message };
  }

  const { error: e2 } = await admin
    .from('menu_items')
    .update({ sort_order: finalSortOrderB })
    .eq('id', rowB.id)
    .eq('restaurant_id', restaurantId);
  if (e2) {
    return { error: 'update_failed', message: e2.message };
  }

  const { error: e3 } = await admin
    .from('menu_items')
    .update({ sort_order: finalSortOrderA })
    .eq('id', rowA.id)
    .eq('restaurant_id', restaurantId);
  if (e3) {
    return { error: 'update_failed', message: e3.message };
  }

  return { ok: true };
}
