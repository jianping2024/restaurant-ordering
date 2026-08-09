import type { UILanguage } from '@/lib/i18n';
import { WAITER_TEXT } from '@/components/waiter/waiter-messages';

/** Page H1 for waiter table detail — uses canonical display_name without a table prefix. */
export function formatWaiterTableDetailHeading(
  lang: UILanguage,
  displayName: string,
): string {
  const { detailsTitle } = WAITER_TEXT[lang];
  return `${detailsTitle} · ${displayName}`;
}

/**
 * Ordered-items sticky money chrome — sole display string for this bar.
 * Shape: optional `餐食: €{meals}` then `合计: €{total}` (never a head-fee segment).
 * Null when session total is not positive.
 */
export function formatWaiterOrderedItemsSessionTotal(
  lang: UILanguage,
  sessionTotal: number,
  mealsTotal = 0,
): string | null {
  if (!(sessionTotal > 0)) return null;
  const copy = WAITER_TEXT[lang];
  const totalText = copy.sessionAmount.replace('{amount}', sessionTotal.toFixed(2));
  if (!(mealsTotal > 0)) return totalText;
  const mealsText = copy.sessionMealsAmount.replace('{amount}', mealsTotal.toFixed(2));
  return `${mealsText} ${totalText}`;
}
