'use client';

import type { BillSplit } from '@/types';
import { CheckoutRequestsManager } from '@/components/dashboard/CheckoutRequestsManager';

interface Props {
  checkoutRequests: BillSplit[];
  restaurantSlug: string;
}

export function CheckoutRequestsPageClient({ checkoutRequests, restaurantSlug }: Props) {
  return (
    <CheckoutRequestsManager
      initialRequests={checkoutRequests}
      restaurantSlug={restaurantSlug}
    />
  );
}
