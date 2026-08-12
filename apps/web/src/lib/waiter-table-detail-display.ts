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

/** Ordered-items sticky money chrome — sole amount shape (never a joined string). */
export type WaiterOrderedItemsSessionAmount = {
  mealsLine: string | null;
  totalLine: string;
};

/**
 * Ordered-items sticky money chrome amounts.
 * `mealsLine` when non-buffet billable total > 0; `totalLine` always when session total > 0.
 * Null when session total is not positive.
 */
export function formatWaiterOrderedItemsSessionTotal(
  lang: UILanguage,
  sessionTotal: number,
  mealsTotal = 0,
): WaiterOrderedItemsSessionAmount | null {
  if (!(sessionTotal > 0)) return null;
  const copy = WAITER_TEXT[lang];
  const totalLine = copy.sessionAmount.replace('{amount}', sessionTotal.toFixed(2));
  const mealsLine =
    mealsTotal > 0
      ? copy.sessionMealsAmount.replace('{amount}', mealsTotal.toFixed(2))
      : null;
  return { mealsLine, totalLine };
}
