import 'server-only';

import { cache } from 'react';
import {
  canUsePremiumFeature,
  normalizePremiumKeys,
  type PremiumKey,
} from '@mesa/shared';
import { createAdminClient } from '@/lib/supabase/admin';
import { NAV_PREMIUM_KEY } from '@/lib/premium/catalog';

export type PlatformProSettings = {
  premiumKeys: PremiumKey[];
  wechatUrl: string | null;
  whatsappUrl: string | null;
};

export type RestaurantTierFields = {
  plan?: string | null;
  pro_valid_until?: string | null;
  license_valid_until?: string | null;
};

export type PremiumGateResult =
  | { ok: true }
  | { ok: false; reason: 'pro_required'; premiumKey: PremiumKey };

async function loadPlatformProSettingsUncached(): Promise<PlatformProSettings> {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { premiumKeys: normalizePremiumKeys(null), wechatUrl: null, whatsappUrl: null };
  }

  const { data, error } = await admin
    .from('platform_pro_settings')
    .select('premium_keys, wechat_url, whatsapp_url')
    .eq('id', 'default')
    .maybeSingle();

  if (error || !data) {
    return { premiumKeys: normalizePremiumKeys(null), wechatUrl: null, whatsappUrl: null };
  }

  return {
    premiumKeys: normalizePremiumKeys(data.premium_keys),
    wechatUrl: typeof data.wechat_url === 'string' ? data.wechat_url.trim() || null : null,
    whatsappUrl: typeof data.whatsapp_url === 'string' ? data.whatsapp_url.trim() || null : null,
  };
}

/** Process-wide cache; ops updates visible on next request after cache miss. */
export const loadPlatformProSettings = cache(loadPlatformProSettingsUncached);

export function resolvePremiumGate(
  restaurant: RestaurantTierFields,
  premiumKey: PremiumKey,
  settings: PlatformProSettings,
  now = new Date(),
): PremiumGateResult {
  const allowed = canUsePremiumFeature({
    premiumKey,
    enabledKeys: settings.premiumKeys,
    plan: restaurant.plan,
    proValidUntil: restaurant.pro_valid_until,
    licenseValidUntil: restaurant.license_valid_until,
    now,
  });
  if (allowed) return { ok: true };
  return { ok: false, reason: 'pro_required', premiumKey };
}

export async function assertPremiumGate(
  restaurant: RestaurantTierFields,
  premiumKey: PremiumKey,
): Promise<PremiumGateResult> {
  const settings = await loadPlatformProSettings();
  return resolvePremiumGate(restaurant, premiumKey, settings);
}
export function navItemProLocked(
  navItemId: string,
  restaurant: RestaurantTierFields,
  settings: PlatformProSettings,
  now = new Date(),
): boolean {
  const premiumKey = NAV_PREMIUM_KEY[navItemId as keyof typeof NAV_PREMIUM_KEY];
  if (!premiumKey) return false;
  const gate = resolvePremiumGate(restaurant, premiumKey, settings, now);
  return !gate.ok;
}

export type PremiumLoaderError = {
  error: 'pro_required';
  status: 403;
  premiumKey: PremiumKey;
};

export async function premiumLoaderCheck(
  restaurant: RestaurantTierFields,
  premiumKey: PremiumKey,
): Promise<PremiumLoaderError | null> {
  const gate = await assertPremiumGate(restaurant, premiumKey);
  if (gate.ok) return null;
  return { error: 'pro_required', status: 403, premiumKey: gate.premiumKey };
}

export function computePremiumLockedNavIds(
  restaurant: RestaurantTierFields,
  settings: PlatformProSettings,
): ReadonlySet<string> {
  const locked = new Set<string>();
  for (const navId of Object.keys(NAV_PREMIUM_KEY) as Array<keyof typeof NAV_PREMIUM_KEY>) {
    if (navItemProLocked(navId, restaurant, settings)) {
      locked.add(navId);
    }
  }
  return locked;
}
