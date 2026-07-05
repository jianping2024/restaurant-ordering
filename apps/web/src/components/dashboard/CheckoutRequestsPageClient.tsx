'use client';

import { useLayoutEffect } from 'react';
import type { BillSplit } from '@/types';
import type { DashboardAccessMode } from '@/lib/dashboard-access';
import { useCheckoutRequests } from '@/components/dashboard/CheckoutRequestsProvider';
import { CheckoutRequestsManager } from '@/components/dashboard/CheckoutRequestsManager';

interface Props {
  checkoutRequests: BillSplit[];
  restaurantId: string;
  restaurantSlug: string;
  accessMode: DashboardAccessMode;
  canCloseTable?: boolean;
  initialTableId?: string;
}

export function CheckoutRequestsPageClient({
  checkoutRequests,
  restaurantId,
  restaurantSlug,
  accessMode,
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
      accessMode={accessMode}
      canCloseTable={canCloseTable}
      initialTableId={initialTableId}
    />
  );
}
