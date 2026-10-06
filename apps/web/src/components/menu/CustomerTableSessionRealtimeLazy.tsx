'use client';

import dynamic from 'next/dynamic';

/** Sole dynamic import boundary for guest table Realtime (SSR-safe). */
export const CustomerTableSessionRealtimeLazy = dynamic(
  () =>
    import('@/components/menu/CustomerTableSessionRealtime').then(
      (m) => m.CustomerTableSessionRealtime,
    ),
  { ssr: false },
);
