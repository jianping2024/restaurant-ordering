'use client';

import type { DashboardAccessMode } from '@/lib/dashboard-access';
import type { CheckoutQueueFocus } from '@/lib/checkout-queue-focus';
import { CheckoutRequestsManager } from '@/components/dashboard/CheckoutRequestsManager';

interface Props {
  restaurantId: string;
  restaurantSlug: string;
  accessMode: DashboardAccessMode;
  canCloseTable?: boolean;
  initialFocus?: CheckoutQueueFocus;
}

export function CheckoutRequestsPageClient({
  restaurantId,
  restaurantSlug,
  accessMode,
  canCloseTable,
  initialFocus,
}: Props) {
  return (
    <CheckoutRequestsManager
      restaurantId={restaurantId}
      restaurantSlug={restaurantSlug}
      accessMode={accessMode}
      canCloseTable={canCloseTable}
      initialFocus={initialFocus}
    />
  );
}
