'use client';

import { useEffect } from 'react';
import { warmCustomerMenuCatalog } from '@/lib/customer-menu-catalog-client-cache';

/** Warm staff ordering catalog while occupied table detail is visible. */
export function useStaffAssistedMenuEntryPrefetch(
  params: { restaurantId: string; slug: string } | null,
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled || !params) return;
    warmCustomerMenuCatalog(params);
  }, [enabled, params]);
}
