'use client';

import dynamic from 'next/dynamic';

/** Sole dynamic import boundary for guest menu-catalog Realtime (SSR-safe). */
export const CustomerMenuCatalogRealtimeLazy = dynamic(
  () =>
    import('@/components/menu/CustomerMenuCatalogRealtime').then(
      (m) => m.CustomerMenuCatalogRealtime,
    ),
  { ssr: false },
);
