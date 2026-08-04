'use client';

import { useCallback, useEffect, useState } from 'react';
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

/**
 * Single client hook for install-shell CTA state.
 * No Service Worker; only display-mode + beforeinstallprompt.
 */
export function usePwaInstall(): {
  surface: PwaInstallSurface;
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
} {
  const [standalone, setStandalone] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    setStandalone(isStandaloneDisplay());

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferred(null);
      setStandalone(true);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
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
    promptInstall,
  };
}
