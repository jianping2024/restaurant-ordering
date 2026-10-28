'use client';

import { useEffect } from 'react';
import { isStandaloneDisplay } from '@/lib/pwa/install-display';

/**
 * Chrome’s installed-app title bar is `manifest.name - document.title`.
 * Guest identity already lives in manifest.name (`店名 · 桌号`); clear
 * document.title in standalone so the bar shows that one segment only.
 * Browser tabs keep the server metadata title unchanged.
 */
export function GuestTableStandaloneTitle() {
  useEffect(() => {
    if (!isStandaloneDisplay()) return;
    document.title = '';
  }, []);
  return null;
}
