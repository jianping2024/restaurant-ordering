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
