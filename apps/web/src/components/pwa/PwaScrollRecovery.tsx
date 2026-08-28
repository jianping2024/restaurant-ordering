'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { resetBodyScrollLock } from '@/lib/body-scroll-lock';

/**
 * Standalone PWA: recover document scroll after bfcache, iOS link-preview, or stale locks.
 * Sole reset entry — route changes and pageshow both call resetBodyScrollLock only.
 */
export function PwaScrollRecovery() {
  const pathname = usePathname();

  useEffect(() => {
    resetBodyScrollLock();
  }, [pathname]);

  useEffect(() => {
    const onPageShow = () => {
      resetBodyScrollLock();
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  return null;
}
