/** Pro trial length for newly registered restaurants. */
export const PRO_TRIAL_DAYS = 90;

export type RestaurantPlan = 'basic' | 'pro';

export const PREMIUM_KEYS = ['value_analytics', 'abnormal_ops', 'operation_logs'] as const;
export type PremiumKey = (typeof PREMIUM_KEYS)[number];

export const DEFAULT_PREMIUM_KEYS: readonly PremiumKey[] = [...PREMIUM_KEYS];

export function isRestaurantPlan(value: string | null | undefined): value is RestaurantPlan {
  return value === 'basic' || value === 'pro';
}

export function isPremiumKey(value: string): value is PremiumKey {
  return (PREMIUM_KEYS as readonly string[]).includes(value);
}

export function normalizePremiumKeys(raw: unknown): PremiumKey[] {
  if (!Array.isArray(raw)) return [...DEFAULT_PREMIUM_KEYS];
  const out: PremiumKey[] = [];
  for (const item of raw) {
    if (typeof item === 'string' && isPremiumKey(item) && !out.includes(item)) {
      out.push(item);
    }
  }
  return out.length > 0 ? out : [...DEFAULT_PREMIUM_KEYS];
}

/** ISO timestamp PRO_TRIAL_DAYS from `from`. */
export function proTrialValidUntil(from = new Date()): string {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() + PRO_TRIAL_DAYS);
  return d.toISOString();
}

/** Extend Pro from current expiry (or now when expired) by `days`. */
export function extendProValidUntil(
  current: string | null | undefined,
  days: number,
  from = new Date(),
): string {
  if (!Number.isFinite(days) || days < 1 || !Number.isInteger(days)) {
    throw new Error('invalid_extend_days');
  }
  const base =
    current && new Date(current).getTime() > from.getTime() ? new Date(current) : new Date(from);
  const next = new Date(base);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString();
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

export function premiumKeyRequiresPro(
  premiumKey: PremiumKey,
  enabledKeys: readonly PremiumKey[],
): boolean {
  return enabledKeys.includes(premiumKey);
}

export function canUsePremiumFeature(input: {
  premiumKey: PremiumKey;
  enabledKeys: readonly PremiumKey[];
} & ProEffectiveInput): boolean {
  if (!premiumKeyRequiresPro(input.premiumKey, input.enabledKeys)) return true;
  return isProEffective(input);
}
