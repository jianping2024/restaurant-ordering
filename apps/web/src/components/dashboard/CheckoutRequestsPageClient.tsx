'use client';

import type { DashboardAccessMode } from '@/lib/dashboard-access';
import type { CheckoutQueueFocus } from '@/lib/checkout-queue-focus';
import { CheckoutRequestsManager } from '@/components/dashboard/CheckoutRequestsManager';

interface Props {
  restaurantId: string;
  restaurantSlug: string;
  accessMode: DashboardAccessMode;
  canForceCloseTable?: boolean;
  initialFocus?: CheckoutQueueFocus;
}

export function CheckoutRequestsPageClient({
  restaurantId,
  restaurantSlug,
  accessMode,
  canForceCloseTable,
  initialFocus,
}: Props) {
  return (
    <CheckoutRequestsManager
      restaurantId={restaurantId}
      restaurantSlug={restaurantSlug}
      accessMode={accessMode}
      canForceCloseTable={canForceCloseTable}
      initialFocus={initialFocus}
    />
  );
}
