import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';

/** Read restaurant buffet config version (staff openable-list freshness token). */
export async function loadBuffetConfigVersion(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<number> {
  const { data, error } = await admin
    .from('restaurants')
    .select('buffet_config_version')
    .eq('id', restaurantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Number(data?.buffet_config_version ?? 0);
}

async function bumpBuffetConfigVersion(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<number> {
  const current = await loadBuffetConfigVersion(admin, restaurantId);
  const next = current + 1;
  const { error } = await admin
    .from('restaurants')
    .update({ buffet_config_version: next })
    .eq('id', restaurantId);
  if (error) throw new Error(error.message);
  return next;
}

/**
 * After dashboard buffet config writes: bump durable version so staff clients
 * re-fetch openable ids. Sole invalidation entry — callers must await.
 */
export async function invalidateBuffetConfig(restaurantId: string): Promise<void> {
  const admin = createAdminClient();
  await bumpBuffetConfigVersion(admin, restaurantId);
}
