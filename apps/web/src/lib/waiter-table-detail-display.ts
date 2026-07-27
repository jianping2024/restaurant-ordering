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

/** Ordered-items sticky chrome — null when there is nothing to show. */
export function formatWaiterOrderedItemsSessionTotal(
  lang: UILanguage,
  sessionTotal: number,
): string | null {
  if (!(sessionTotal > 0)) return null;
  return WAITER_TEXT[lang].sessionAmount.replace('{amount}', sessionTotal.toFixed(2));
}
