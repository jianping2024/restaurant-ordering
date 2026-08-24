'use client';

import { useEffect } from 'react';
import { pwaShellSwRegisterUrl } from '@/lib/pwa/shell-sw';

type Props = {
  /** From getWebAppBuildInfo().version — empty becomes `dev` inside register URL. */
  version: string;
};

/**
 * Sole browser registration for the install-only shell SW.
 * Do not register any other service worker beside this.
 */
export function PwaShellSwRegister({ version }: Props) {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    const url = pwaShellSwRegisterUrl(version);
    void navigator.serviceWorker.register(url, {
      scope: '/',
      updateViaCache: 'none',
    }).catch(() => {
      /* insecure context / blocked — fail open (network-only, same as before SW) */
    });
  }, [version]);

  return null;
}
