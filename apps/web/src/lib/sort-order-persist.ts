import type { SupabaseClient } from '@supabase/supabase-js';

type RestaurantScopedTable =
  | 'menu_items'
  | 'print_stations'
  | 'restaurant_table_groups'
  | 'menu_recommended_items';

/**
 * Persist a full scope order under restaurant_id with two-phase writes
 * (park at offset+i, then final 0..n-1) to avoid unique-index collisions.
 */
export async function persistZeroBasedSortOrders(
  admin: SupabaseClient,
  table: RestaurantScopedTable,
  restaurantId: string,
  orderedIds: readonly string[],
  scopeMaxSortOrder: number,
): Promise<{ ok: true } | { error: 'update_failed'; message: string }> {
  if (orderedIds.length === 0) return { ok: true };

  const offset = scopeMaxSortOrder + 1;

  for (let i = 0; i < orderedIds.length; i += 1) {
    const { error } = await admin
      .from(table)
      .update({ sort_order: offset + i })
      .eq('id', orderedIds[i])
      .eq('restaurant_id', restaurantId);
    if (error) {
      return { error: 'update_failed', message: error.message };
    }
  }

  for (let i = 0; i < orderedIds.length; i += 1) {
    const { error } = await admin
      .from(table)
      .update({ sort_order: i })
      .eq('id', orderedIds[i])
      .eq('restaurant_id', restaurantId);
    if (error) {
      return { error: 'update_failed', message: error.message };
    }
  }

  return { ok: true };
}

/**
 * Two-phase write of explicit { id, sort_order } assignments
 * (used when reordering a subset that must keep its existing order values).
 */
export async function persistAssignedSortOrders(
  admin: SupabaseClient,
  table: 'restaurant_tables',
  restaurantId: string,
  assignments: readonly { id: string; sort_order: number }[],
  tempBase: number,
): Promise<{ ok: true } | { error: 'update_failed'; message: string }> {
  if (assignments.length === 0) return { ok: true };

  for (let i = 0; i < assignments.length; i += 1) {
    const { error } = await admin
      .from(table)
      .update({ sort_order: tempBase + i })
      .eq('id', assignments[i]!.id)
      .eq('restaurant_id', restaurantId);
    if (error) {
      return { error: 'update_failed', message: error.message };
    }
  }

  for (const row of assignments) {
    const { error } = await admin
      .from(table)
      .update({ sort_order: row.sort_order })
      .eq('id', row.id)
      .eq('restaurant_id', restaurantId);
    if (error) {
      return { error: 'update_failed', message: error.message };
    }
  }

  return { ok: true };
}
