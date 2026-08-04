/**
 * Install-shell display helpers (no Service Worker / offline).
 * Single place for “already app window?” and which install CTA surface to show.
 */

export type PwaInstallSurface = 'hidden' | 'browser_prompt' | 'manual_hint';

/** True when the document is already running as an installed app window. */
export function isStandaloneDisplay(
  mediaMatches: (query: string) => boolean = (q) =>
    typeof window !== 'undefined' && window.matchMedia(q).matches,
  nav: { standalone?: boolean } | null | undefined = typeof navigator !== 'undefined'
    ? (navigator as { standalone?: boolean })
    : undefined,
): boolean {
  if (mediaMatches('(display-mode: standalone)')) return true;
  if (mediaMatches('(display-mode: window-controls-overlay)')) return true;
  if (nav?.standalone === true) return true;
  return false;
}

/**
 * One mapping: standalone → hide; native install event ready → prompt button;
 * otherwise → short manual install hint (Chrome menu / iOS Add to Home Screen).
 */
export function resolvePwaInstallSurface(input: {
  standalone: boolean;
  deferredPromptAvailable: boolean;
}): PwaInstallSurface {
  if (input.standalone) return 'hidden';
  if (input.deferredPromptAvailable) return 'browser_prompt';
  return 'manual_hint';
}
