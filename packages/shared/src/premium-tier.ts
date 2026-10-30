import {
  addLisbonCalendarDays,
  licenseValidUntilEndOfLisbonDay,
  lisbonCalendarDateFromInstant,
} from './license-calendar';

/** Pro trial length for newly registered restaurants (Lisbon civil days). */
export const PRO_TRIAL_DAYS = 90;

export type RestaurantPlan = 'basic' | 'pro';

export const PREMIUM_KEYS = ['value_analytics', 'abnormal_ops', 'operation_logs', 'menu_dish_video'] as const;
export type PremiumKey = (typeof PREMIUM_KEYS)[number];

export const DEFAULT_PREMIUM_KEYS: readonly PremiumKey[] = [...PREMIUM_KEYS];

export type ProBillingPeriod = 'month' | 'year';

export type ProFeatureProduct = {
  featureKey: PremiumKey;
  priceMonthEur: number;
  priceYearEur: number;
  active: boolean;
};

/** Platform base subscription list price (no Pro add-ons). */
export type SubscriptionBaseProduct = {
  priceMonthEur: number;
  priceYearEur: number;
};

export function isRestaurantPlan(value: string | null | undefined): value is RestaurantPlan {
  return value === 'basic' || value === 'pro';
}

/**
 * Persist-safe plan for restaurants.plan (CHECK basic|pro).
 * Legacy `free` → basic; missing/invalid → basic.
 */
export function normalizeRestaurantPlan(value: string | null | undefined): RestaurantPlan {
  if (value === 'pro') return 'pro';
  if (value === 'basic' || value === 'free') return 'basic';
  return 'basic';
}

export function isPremiumKey(value: string): value is PremiumKey {
  return (PREMIUM_KEYS as readonly string[]).includes(value);
}

/**
 * Normalize an entitlement / grant list.
 * Explicit `[]` stays empty. Non-array / missing → product defaults.
 * All-invalid entries → defaults (not empty wipe).
 */
export function normalizePremiumKeys(raw: unknown): PremiumKey[] {
  if (!Array.isArray(raw)) return [...DEFAULT_PREMIUM_KEYS];
  if (raw.length === 0) return [];
  const out: PremiumKey[] = [];
  for (const item of raw) {
    if (typeof item === 'string' && isPremiumKey(item) && !out.includes(item)) {
      out.push(item);
    }
  }
  return out.length > 0 ? out : [...DEFAULT_PREMIUM_KEYS];
}

/** Grant list from Ops/API: empty allowed; invalid dropped; never invent defaults. */
export function normalizePremiumKeyGrants(raw: unknown): PremiumKey[] {
  if (!Array.isArray(raw)) return [];
  const out: PremiumKey[] = [];
  for (const item of raw) {
    if (typeof item === 'string' && isPremiumKey(item) && !out.includes(item)) {
      out.push(item);
    }
  }
  return out;
}

/**
 * Pro trial expiry: Lisbon civil date of `from` + PRO_TRIAL_DAYS, end of that Lisbon day.
 * Same calendar representation as Ops license / Pro valid-until.
 */
export function proTrialValidUntil(from = new Date()): string {
  const startYmd = lisbonCalendarDateFromInstant(from);
  const endYmd = addLisbonCalendarDays(startYmd, PRO_TRIAL_DAYS);
  return licenseValidUntilEndOfLisbonDay(endYmd);
}

export type ProEffectiveInput = {
  plan: string | null | undefined;
  proValidUntil: string | null | undefined;
  licenseValidUntil: string | null | undefined;
  now?: Date;
};

/** Store has active Pro entitlement (plan + pro window + license window). */
export function isProEffective(input: ProEffectiveInput): boolean {
  const now = input.now ?? new Date();
  if (input.plan !== 'pro') return false;
  if (input.proValidUntil && new Date(input.proValidUntil) <= now) return false;
  if (input.licenseValidUntil && new Date(input.licenseValidUntil) <= now) return false;
  return true;
}

/**
 * Sole commercial gate: effective Pro + per-restaurant grant for this feature.
 * Store feature_flags are a separate operational layer on top.
 */
export function canUsePremiumFeature(
  input: {
    premiumKey: PremiumKey;
    entitledKeys: readonly PremiumKey[];
  } & ProEffectiveInput,
): boolean {
  if (!isProEffective(input)) return false;
  return input.entitledKeys.includes(input.premiumKey);
}

function nonNegativeMoney(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100) / 100;
}

/** Parse one catalog row from DB / API JSON. */
export function parseProFeatureProduct(raw: unknown): ProFeatureProduct | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const keyRaw =
    typeof row.featureKey === 'string'
      ? row.featureKey
      : typeof row.feature_key === 'string'
        ? row.feature_key
        : null;
  if (!keyRaw || !isPremiumKey(keyRaw)) return null;
  const month = nonNegativeMoney(
    row.priceMonthEur ?? row.price_month_eur ?? row.priceMonthEUR,
  );
  const year = nonNegativeMoney(row.priceYearEur ?? row.price_year_eur ?? row.priceYearEUR);
  if (month == null || year == null) return null;
  return {
    featureKey: keyRaw,
    priceMonthEur: month,
    priceYearEur: year,
    active: row.active !== false,
  };
}

/** Parse base subscription list price from DB / API JSON. */
export function parseSubscriptionBaseProduct(raw: unknown): SubscriptionBaseProduct | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const month = nonNegativeMoney(
    row.priceMonthEur ?? row.price_month_eur ?? row.priceMonthEUR,
  );
  const year = nonNegativeMoney(row.priceYearEur ?? row.price_year_eur ?? row.priceYearEUR);
  if (month == null || year == null) return null;
  return { priceMonthEur: month, priceYearEur: year };
}

/** Base list price for one billing period (missing base → 0). */
export function quoteSubscriptionBaseEur(
  base: SubscriptionBaseProduct | null | undefined,
  period: ProBillingPeriod,
): number {
  if (!base) return 0;
  return period === 'month' ? base.priceMonthEur : base.priceYearEur;
}

/** Pro add-on subtotal: sum list prices for entitled keys (inactive catalog rows skipped). */
export function quoteProFeaturesEur(
  entitledKeys: readonly PremiumKey[],
  products: readonly ProFeatureProduct[],
  period: ProBillingPeriod,
): number {
  const byKey = new Map(products.filter((p) => p.active).map((p) => [p.featureKey, p]));
  let sum = 0;
  for (const key of entitledKeys) {
    const product = byKey.get(key);
    if (!product) continue;
    sum += period === 'month' ? product.priceMonthEur : product.priceYearEur;
  }
  return Math.round(sum * 100) / 100;
}

/**
 * Sole restaurant subscription quote:
 * base plan list price + Pro feature add-ons for the same period.
 */
export function quoteRestaurantSubscriptionEur(
  base: SubscriptionBaseProduct | null | undefined,
  entitledKeys: readonly PremiumKey[],
  products: readonly ProFeatureProduct[],
  period: ProBillingPeriod,
): number {
  const total =
    quoteSubscriptionBaseEur(base, period) + quoteProFeaturesEur(entitledKeys, products, period);
  return Math.round(total * 100) / 100;
}

/** Trial / new-Pro seed rows for `restaurant_pro_feature_grants` (all known keys). */
export function proTrialFeatureGrantRows(restaurantId: string): Array<{
  restaurant_id: string;
  feature_key: PremiumKey;
}> {
  return DEFAULT_PREMIUM_KEYS.map((feature_key) => ({
    restaurant_id: restaurantId,
    feature_key,
  }));
}
