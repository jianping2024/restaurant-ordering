'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Prefetch staff-assisted menu entry while occupied table detail is visible. */
export function useStaffAssistedMenuEntryPrefetch(menuHref: string, enabled: boolean) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;
    router.prefetch(menuHref);
  }, [enabled, menuHref, router]);
}
