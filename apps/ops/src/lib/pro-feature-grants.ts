import type { SupabaseClient } from '@supabase/supabase-js';
import { sanitizePremiumKeyGrants, type PremiumKey } from '@mesa/shared';

/**
 * Sole Ops write for restaurant_pro_feature_grants: replace full set + bump menu catalog.
 * Callers must already enforce plan=pro (or equivalent gate).
 */
export async function replaceRestaurantProFeatureGrants(
  admin: SupabaseClient,
  restaurantId: string,
  rawFeatureKeys: unknown,
): Promise<
  | { ok: true; featureKeys: PremiumKey[] }
  | { ok: false; error: string; status: number; detail?: string }
> {
  const featureKeys = sanitizePremiumKeyGrants(rawFeatureKeys);

  const { error: delErr } = await admin
    .from('restaurant_pro_feature_grants')
    .delete()
    .eq('restaurant_id', restaurantId);
  if (delErr) {
    return { ok: false, error: 'update_failed', status: 500, detail: delErr.message };
  }

  if (featureKeys.length > 0) {
    const rows = featureKeys.map((feature_key) => ({
      restaurant_id: restaurantId,
      feature_key,
    }));
    const { error: insErr } = await admin.from('restaurant_pro_feature_grants').insert(rows);
    if (insErr) {
      return { ok: false, error: 'update_failed', status: 500, detail: insErr.message };
    }
  }

  const { data: verRow } = await admin
    .from('restaurants')
    .select('menu_catalog_version')
    .eq('id', restaurantId)
    .maybeSingle();
  const nextVer = Number(verRow?.menu_catalog_version ?? 0) + 1;
  await admin.from('restaurants').update({ menu_catalog_version: nextVer }).eq('id', restaurantId);
  await admin.from('menu_catalog_signals').upsert(
    { restaurant_id: restaurantId, version: nextVer, bumped_at: new Date().toISOString() },
    { onConflict: 'restaurant_id' },
  );

  return { ok: true, featureKeys };
}
