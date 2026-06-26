/** Common Portuguese IVA rates (percent). */
export const MENU_VAT_RATE_OPTIONS = [0, 6, 13, 23] as const;

export type MenuVatRateOption = (typeof MENU_VAT_RATE_OPTIONS)[number];

export const DEFAULT_MENU_VAT_RATE: MenuVatRateOption = 23;

export function parseMenuVatRate(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const rate = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) return null;
  return rate;
}

export function normalizeMenuVatRate(value: string | number | null | undefined): number {
  return parseMenuVatRate(value) ?? DEFAULT_MENU_VAT_RATE;
}

export function isAllowedMenuVatRate(value: number): value is MenuVatRateOption {
  return (MENU_VAT_RATE_OPTIONS as readonly number[]).includes(value);
}
