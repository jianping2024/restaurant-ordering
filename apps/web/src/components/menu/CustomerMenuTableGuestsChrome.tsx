'use client';

import type { Language } from '@/types';
import {
  CUSTOMER_MENU_TABLE_GUESTS_CHROME_CLASS,
  CUSTOMER_MENU_TABLE_GUESTS_LABEL_CLASS,
  formatCustomerMenuTableGuestsLabel,
} from '@/lib/customer-menu-table-guests';

type Props = {
  guestCount: number;
  lang: Language;
};

/** Sole headcount text node (guest sticky + classic chrome). */
export function CustomerMenuTableGuestsLabel({ guestCount, lang }: Props) {
  return (
    <span className={CUSTOMER_MENU_TABLE_GUESTS_LABEL_CLASS}>
      {formatCustomerMenuTableGuestsLabel(guestCount, lang)}
    </span>
  );
}

/**
 * Sole standalone headcount strip for classic / staff continue-order
 * (when SushiRoundStickyBar is not mounted).
 */
export function CustomerMenuTableGuestsChrome({ guestCount, lang }: Props) {
  return (
    <div className={CUSTOMER_MENU_TABLE_GUESTS_CHROME_CLASS}>
      <p className="flex min-h-8 items-center">
        <CustomerMenuTableGuestsLabel guestCount={guestCount} lang={lang} />
      </p>
    </div>
  );
}
