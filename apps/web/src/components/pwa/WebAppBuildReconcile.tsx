'use client';

import { useEffect } from 'react';
import {
  fetchLiveHealthVersion,
  takeWebAppBuildReloadDecision,
} from '@/lib/web-app-build-reconcile';

type Props = {
  /** From getWebAppBuildInfo().version — baked into this document. */
  version: string;
};

function storageOrNull(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function reloadIfBuildMismatch(pageVersion: string, liveVersion: string | null): void {
  const decision = takeWebAppBuildReloadDecision(pageVersion, liveVersion, storageOrNull());
  if (!decision.reload) return;
  window.location.reload();
}

/**
 * Sole client gate: page build must match `/api/health/live.version`.
 * Also listens for shell SW controllerchange (same reload path).
 * Mount once from root layout beside {@link PwaShellSwRegister}.
 */
export function WebAppBuildReconcile({ version }: Props) {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let cancelled = false;

    const reconcile = async (opts?: { updateSw?: boolean }) => {
      if (opts?.updateSw && 'serviceWorker' in navigator) {
        try {
          const reg = await navigator.serviceWorker.getRegistration();
          await reg?.update();
        } catch {
          /* ignore */
        }
      }
      const live = await fetchLiveHealthVersion();
      if (cancelled) return;
      reloadIfBuildMismatch(version, live);
    };

    void reconcile({ updateSw: true });

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      void reconcile({ updateSw: true });
    };
    document.addEventListener('visibilitychange', onVisible);

    const onControllerChange = () => {
      // New SW claimed this tab — document JS may still be the previous build.
      void reconcile({ updateSw: false });
    };
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    }

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      }
    };
  }, [version]);

  return null;
}
