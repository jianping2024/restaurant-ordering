'use client';

import { useEffect } from 'react';
import { lockBodyScroll } from '@/lib/body-scroll-lock';

/** Sole hook for modal/sheet scroll lock — wraps lockBodyScroll only. */
export function useBodyScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    return lockBodyScroll();
  }, [active]);
}
