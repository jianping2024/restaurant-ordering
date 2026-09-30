import type { AllergenCode } from '@/lib/allergens';
import { isAllergenCode } from '@/lib/allergens';
import type { MenuItem } from '@/types';

/** Sole guest dietary filter prefs (client-only; sushi sticky). */
export type CustomerMenuDietaryFilterPrefs = {
  vegetarianOnly: boolean;
  excludeAllergenCodes: readonly AllergenCode[];
};

export const EMPTY_CUSTOMER_MENU_DIETARY_FILTER_PREFS: CustomerMenuDietaryFilterPrefs = {
  vegetarianOnly: false,
  excludeAllergenCodes: [],
};

/**
 * Sole catalog filter for guest dietary prefs.
 * vegetarianOnly → keep is_vegetarian; exclude codes → hide dishes whose allergen_codes intersect
 * (unmarked dishes stay visible).
 */
export function filterMenuItemsByDietaryPrefs(
  items: readonly MenuItem[],
  prefs: CustomerMenuDietaryFilterPrefs,
): MenuItem[] {
  const exclude = prefs.excludeAllergenCodes;
  const needVeg = prefs.vegetarianOnly;
  if (!needVeg && exclude.length === 0) return [...items];

  const excludeSet = new Set(exclude);
  return items.filter((item) => {
    if (needVeg && !item.is_vegetarian) return false;
    if (excludeSet.size === 0) return true;
    const codes = item.allergen_codes ?? [];
    for (const code of codes) {
      if (excludeSet.has(code as AllergenCode)) return false;
    }
    return true;
  });
}

/** Normalize draft allergen picks; drops unknown codes. */
export function normalizeExcludeAllergenCodes(raw: readonly string[]): AllergenCode[] {
  const out: AllergenCode[] = [];
  const seen = new Set<string>();
  for (const value of raw) {
    if (!isAllergenCode(value) || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

export function toggleExcludeAllergenCode(
  current: readonly AllergenCode[],
  code: AllergenCode,
): AllergenCode[] {
  if (current.includes(code)) return current.filter((c) => c !== code);
  return [...current, code];
}
