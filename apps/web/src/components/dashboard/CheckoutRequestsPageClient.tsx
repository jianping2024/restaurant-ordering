'use client';

import type { BillSplit } from '@/types';
import { CheckoutRequestsManager } from '@/components/dashboard/CheckoutRequestsManager';

interface Props {
  checkoutRequests: BillSplit[];
  restaurantId: string;
  restaurantSlug: string;
}

export function CheckoutRequestsPageClient({
  checkoutRequests,
  restaurantId,
  restaurantSlug,
}: Props) {
  return (
    <CheckoutRequestsManager
      initialRequests={checkoutRequests}
      restaurantId={restaurantId}
      restaurantSlug={restaurantSlug}
    />
  );
}
