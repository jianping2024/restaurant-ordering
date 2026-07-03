'use client';

import { useLayoutEffect } from 'react';
import type { BillSplit } from '@/types';
import { useCheckoutRequests } from '@/components/dashboard/CheckoutRequestsProvider';
import { CheckoutRequestsManager } from '@/components/dashboard/CheckoutRequestsManager';

interface Props {
  checkoutRequests: BillSplit[];
  restaurantId: string;
  restaurantSlug: string;
  canCloseTable?: boolean;
  initialTableId?: string;
}

export function CheckoutRequestsPageClient({
  checkoutRequests,
  restaurantId,
  restaurantSlug,
  canCloseTable,
  initialTableId,
}: Props) {
  const { hydrateFromServer } = useCheckoutRequests();

  useLayoutEffect(() => {
    hydrateFromServer(checkoutRequests);
  }, [checkoutRequests, hydrateFromServer]);

  return (
    <CheckoutRequestsManager
      restaurantId={restaurantId}
      restaurantSlug={restaurantSlug}
      canCloseTable={canCloseTable}
      initialTableId={initialTableId}
    />
  );
}
