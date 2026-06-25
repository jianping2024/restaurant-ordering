'use client';

import type { BillSplit } from '@/types';
import { CheckoutRequestsManager } from '@/components/dashboard/CheckoutRequestsManager';

interface Props {
  checkoutRequests: BillSplit[];
  restaurantId: string;
  restaurantSlug: string;
  showPrinterSettings?: boolean;
  initialTableId?: string;
}

export function CheckoutRequestsPageClient({
  checkoutRequests,
  restaurantId,
  restaurantSlug,
  showPrinterSettings,
  initialTableId,
}: Props) {
  return (
    <CheckoutRequestsManager
      initialRequests={checkoutRequests}
      restaurantId={restaurantId}
      restaurantSlug={restaurantSlug}
      showPrinterSettings={showPrinterSettings}
      initialTableId={initialTableId}
    />
  );
}
