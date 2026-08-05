'use client';

import { useCallback, useLayoutEffect, useState } from 'react';
import {
  isStandaloneDisplay,
  resolvePwaInstallSurface,
  type PwaInstallSurface,
} from '@/lib/pwa/install-display';

/** Chromium `beforeinstallprompt` — not in all TS DOM libs. */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

/** Wait once on mount for BIP before choosing manual vs browser prompt (avoids login layout flip). */
export const PWA_INSTALL_SURFACE_SETTLE_MS = 400;

/**
 * Single client hook for install-shell CTA state.
 * No Service Worker; only display-mode + beforeinstallprompt.
 */
export function usePwaInstall(): {
  surface: PwaInstallSurface;
  surfaceReady: boolean;
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
} {
  const [standalone, setStandalone] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [surfaceReady, setSurfaceReady] = useState(false);

  useLayoutEffect(() => {
    const isStandalone = isStandaloneDisplay();
    setStandalone(isStandalone);
    if (isStandalone) {
      setSurfaceReady(true);
      return;
    }

    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      setSurfaceReady(true);
    };

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      settle();
    };
    const onInstalled = () => {
      setDeferred(null);
      setStandalone(true);
      settle();
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    const timer = window.setTimeout(settle, PWA_INSTALL_SURFACE_SETTLE_MS);

    return () => {
      settled = true;
      window.clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferred) return 'unavailable' as const;
    const event = deferred;
    setDeferred(null);
    await event.prompt();
    const { outcome } = await event.userChoice;
    if (outcome === 'accepted') setStandalone(true);
    return outcome;
  }, [deferred]);

  return {
    surface: resolvePwaInstallSurface({
      standalone,
      deferredPromptAvailable: deferred != null,
    }),
    surfaceReady,
    promptInstall,
  };
}
