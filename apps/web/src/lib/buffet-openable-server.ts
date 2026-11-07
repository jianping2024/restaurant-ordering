import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Sole read of「当前可开的套餐」: SQL `buffet_openable_ids` (store's current slot + today's
 * calendar kind has an active in-date rule). Cold open + buffet switch gate and the open list.
 */
export async function loadOpenableBuffetIds(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<string[]> {
  const { data, error } = await admin.rpc('buffet_openable_ids', {
    p_restaurant_id: restaurantId,
  });
  if (error) throw new Error(error.message || 'buffet_openable_ids_failed');
  return ((data ?? []) as unknown[]).map((id) => String(id));
}
