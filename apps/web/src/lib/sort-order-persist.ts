import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Persist a full scope order for menu_items under unique (restaurant, category, sort_order).
 * Two-phase: first park at offset+i, then write final 0..n-1.
 */
export async function persistMenuItemSortOrders(
  admin: SupabaseClient,
  restaurantId: string,
  orderedIds: readonly string[],
  scopeMaxSortOrder: number,
): Promise<{ ok: true } | { error: 'update_failed'; message: string }> {
  if (orderedIds.length === 0) return { ok: true };

  const offset = scopeMaxSortOrder + 1;

  for (let i = 0; i < orderedIds.length; i += 1) {
    const { error } = await admin
      .from('menu_items')
      .update({ sort_order: offset + i })
      .eq('id', orderedIds[i])
      .eq('restaurant_id', restaurantId);
    if (error) {
      return { error: 'update_failed', message: error.message };
    }
  }

  for (let i = 0; i < orderedIds.length; i += 1) {
    const { error } = await admin
      .from('menu_items')
      .update({ sort_order: i })
      .eq('id', orderedIds[i])
      .eq('restaurant_id', restaurantId);
    if (error) {
      return { error: 'update_failed', message: error.message };
    }
  }

  return { ok: true };
}
