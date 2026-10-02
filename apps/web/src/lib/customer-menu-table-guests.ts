/**
 * Sole on-screen table headcount label for guest sushi sticky + staff continue-order.
 * Count source: `sessionGuestCountForLimits` / round `live_guest_count` (same formula).
 * Copy: `MENU_PAGE_MESSAGES.tableGuestsCap` only — never parallel stickyGuestsCap.
 */

import { MENU_PAGE_MESSAGES } from '@/lib/i18n/menu-page-messages';
import type { Language } from '@/types';

/** Sole face for the headcount span (sticky inline + classic chrome strip). */
export const CUSTOMER_MENU_TABLE_GUESTS_LABEL_CLASS =
  'whitespace-nowrap text-[13px] leading-snug text-brand-text';

/** Sole strip shell when headcount is not inside SushiRoundStickyBar. */
export const CUSTOMER_MENU_TABLE_GUESTS_CHROME_CLASS =
  'border-b border-brand-border bg-brand-card/95 px-4 py-2';

export function formatCustomerMenuTableGuestsLabel(
  guestCount: number,
  lang: Language,
): string {
  const n = Number.isFinite(guestCount) ? Math.max(0, Math.floor(guestCount)) : 0;
  return MENU_PAGE_MESSAGES[lang].tableGuestsCap.replace('{guests}', String(n));
}
