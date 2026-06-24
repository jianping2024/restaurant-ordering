/** ISO 3166-1 alpha-2 codes supported in onboarding / ops forms. */
export const RESTAURANT_COUNTRY_OPTIONS = [
  { code: 'PT', label: '葡萄牙 (PT)' },
  { code: 'CN', label: '中国 (CN)' },
  { code: 'MO', label: '澳门 (MO)' },
  { code: 'HK', label: '香港 (HK)' },
  { code: 'GB', label: '英国 (GB)' },
  { code: 'US', label: '美国 (US)' },
] as const;

export type RestaurantCountryCode = (typeof RESTAURANT_COUNTRY_OPTIONS)[number]['code'];

const ALLOWED = new Set<string>(RESTAURANT_COUNTRY_OPTIONS.map((o) => o.code));

export function normalizeCountryCode(raw: unknown): RestaurantCountryCode | null {
  if (typeof raw !== 'string') return null;
  const code = raw.trim().toUpperCase();
  if (!ALLOWED.has(code)) return null;
  return code as RestaurantCountryCode;
}

export function countryCodeLabel(code: string): string {
  const found = RESTAURANT_COUNTRY_OPTIONS.find((o) => o.code === code);
  return found ? found.label : code;
}
