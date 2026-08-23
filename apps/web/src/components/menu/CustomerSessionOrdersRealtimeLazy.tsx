import dynamic from 'next/dynamic';

/** Sole dynamic import boundary for guest session orders Realtime (SSR-safe). */
export const CustomerSessionOrdersRealtimeLazy = dynamic(
  () =>
    import('@/components/menu/CustomerSessionOrdersRealtime').then(
      (m) => m.CustomerSessionOrdersRealtime,
    ),
  { ssr: false },
);
