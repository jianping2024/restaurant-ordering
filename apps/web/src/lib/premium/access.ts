import 'server-only';

import { cache } from 'react';
import {
  canUsePremiumFeature,
  sanitizePremiumKeyGrants,
  RESTAURANT_FEATURE_DEFINITIONS,
  type PremiumKey,
  type RestaurantFeatureKey,
} from '@mesa/shared';
import { createAdminClient } from '@/lib/supabase/admin';
import { NAV_PREMIUM_KEY } from '@/lib/premium/catalog';

export type RestaurantTierFields = {
  id?: string | null;
  plan?: string | null;
  pro_valid_until?: string | null;
  license_valid_until?: string | null;
};

export type PremiumGateResult =
  | { ok: true }
  | { ok: false; reason: 'pro_required'; premiumKey: PremiumKey };

async function loadRestaurantProEntitledKeysUncached(restaurantId: string): Promise<PremiumKey[]> {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return [];
  }

  const { data, error } = await admin
    .from('restaurant_pro_feature_grants')
    .select('feature_key')
    .eq('restaurant_id', restaurantId);

  if (error || !data) return [];
  return sanitizePremiumKeyGrants(data.map((row) => row.feature_key));
}

/** Process-wide cache of per-restaurant Pro feature grants. */
export const loadRestaurantProEntitledKeys = cache(loadRestaurantProEntitledKeysUncached);

export function resolvePremiumGate(
  restaurant: RestaurantTierFields,
  premiumKey: PremiumKey,
  entitledKeys: readonly PremiumKey[],
  now = new Date(),
): PremiumGateResult {
  const allowed = canUsePremiumFeature({
    premiumKey,
    entitledKeys,
    plan: restaurant.plan,
    proValidUntil: restaurant.pro_valid_until,
    licenseValidUntil: restaurant.license_valid_until,
    now,
  });
  if (allowed) return { ok: true };
  return { ok: false, reason: 'pro_required', premiumKey };
}

export async function assertPremiumGate(
  restaurant: RestaurantTierFields & { id: string },
  premiumKey: PremiumKey,
): Promise<PremiumGateResult> {
  const entitledKeys = await loadRestaurantProEntitledKeys(restaurant.id);
  return resolvePremiumGate(restaurant, premiumKey, entitledKeys);
}

export function navItemProLocked(
  navItemId: string,
  restaurant: RestaurantTierFields,
  entitledKeys: readonly PremiumKey[],
  now = new Date(),
): boolean {
  const premiumKey = NAV_PREMIUM_KEY[navItemId as keyof typeof NAV_PREMIUM_KEY];
  if (!premiumKey) return false;
  const gate = resolvePremiumGate(restaurant, premiumKey, entitledKeys, now);
  return !gate.ok;
}

/** Feature-settings toggles whose `premiumKey` is not effective for this restaurant. */
export function computePremiumLockedFeatureKeys(
  restaurant: RestaurantTierFields,
  entitledKeys: readonly PremiumKey[],
  now = new Date(),
): RestaurantFeatureKey[] {
  return RESTAURANT_FEATURE_DEFINITIONS.filter(
    (def) => def.premiumKey && !resolvePremiumGate(restaurant, def.premiumKey, entitledKeys, now).ok,
  ).map((def) => def.key);
}

export type PremiumLoaderError = {
  error: 'pro_required';
  status: 403;
  premiumKey: PremiumKey;
};

export async function premiumLoaderCheck(
  restaurant: RestaurantTierFields & { id: string },
  premiumKey: PremiumKey,
): Promise<PremiumLoaderError | null> {
  const gate = await assertPremiumGate(restaurant, premiumKey);
  if (gate.ok) return null;
  return { error: 'pro_required', status: 403, premiumKey: gate.premiumKey };
}

export function computePremiumLockedNavIds(
  restaurant: RestaurantTierFields,
  entitledKeys: readonly PremiumKey[],
): ReadonlySet<string> {
  const locked = new Set<string>();
  for (const navId of Object.keys(NAV_PREMIUM_KEY) as Array<keyof typeof NAV_PREMIUM_KEY>) {
    if (navItemProLocked(navId, restaurant, entitledKeys)) {
      locked.add(navId);
    }
  }
  return locked;
}
