'use client';

import type { BillSplit } from '@/types';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import { CheckoutRequestsManager } from '@/components/dashboard/CheckoutRequestsManager';

interface Props {
  checkoutRequests: BillSplit[];
  restaurantSlug: string;
}

export function CheckoutRequestsPageClient({ checkoutRequests, restaurantSlug }: Props) {
  const { lang } = useLanguage();
  const nav = getMessages(lang).nav;

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-heading text-3xl text-brand-text">{nav.checkout}</h1>
      </div>

      <CheckoutRequestsManager
        initialRequests={checkoutRequests}
        restaurantSlug={restaurantSlug}
      />
    </div>
  );
}
