/**
 * Install-shell display helpers (no Service Worker / offline).
 * Single place for “already app window?” and which install CTA surface to show.
 */

export type PwaInstallSurface = 'hidden' | 'browser_prompt' | 'manual_entry';

/**
 * Sole display-mode queries for “installed app window”.
 * Shared by `isStandaloneDisplay` and the PWA launch-shell boot script.
 */
export const STANDALONE_DISPLAY_MEDIA_QUERIES = [
  '(display-mode: standalone)',
  '(display-mode: window-controls-overlay)',
] as const;

/** True when the document is already running as an installed app window. */
export function isStandaloneDisplay(
  mediaMatches: (query: string) => boolean = (q) =>
    typeof window !== 'undefined' && window.matchMedia(q).matches,
  nav: { standalone?: boolean } | null | undefined = typeof navigator !== 'undefined'
    ? (navigator as { standalone?: boolean })
    : undefined,
): boolean {
  for (const query of STANDALONE_DISPLAY_MEDIA_QUERIES) {
    if (mediaMatches(query)) return true;
  }
  if (nav?.standalone === true) return true;
  return false;
}

/**
 * One mapping: standalone → hide; native install event ready → prompt button;
 * otherwise → short manual entry (lead + how-to opens steps guide).
 */
export function resolvePwaInstallSurface(input: {
  standalone: boolean;
  deferredPromptAvailable: boolean;
}): PwaInstallSurface {
  if (input.standalone) return 'hidden';
  if (input.deferredPromptAvailable) return 'browser_prompt';
  return 'manual_entry';
}
