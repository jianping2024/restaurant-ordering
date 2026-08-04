import { isStandaloneDisplay } from './install-display';

/**
 * Outcome of opening a customer-facing HTTP URL from staff UI.
 * Browser tab → new tab; installed app shell → clipboard only (never a second PWA window).
 */
export type PreferBrowserOpenResult =
  | { mode: 'browser_tab' }
  | { mode: 'clipboard'; ok: true }
  | { mode: 'clipboard'; ok: false };

export type OpenPreferBrowserDeps = {
  isStandalone?: () => boolean;
  openTab?: (url: string) => void;
  writeClipboard?: (text: string) => Promise<boolean>;
};

async function defaultWriteClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  return false;
}

function defaultOpenTab(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Sole opener for staff “open scan / customer URL” actions.
 * Never `target=_blank` / `window.open` while already standalone — that spawns a second app shell.
 */
export async function openHttpUrlPreferBrowser(
  url: string,
  deps: OpenPreferBrowserDeps = {},
): Promise<PreferBrowserOpenResult> {
  const standalone = (deps.isStandalone ?? (() => isStandaloneDisplay()))();
  if (!standalone) {
    (deps.openTab ?? defaultOpenTab)(url);
    return { mode: 'browser_tab' };
  }
  const ok = await (deps.writeClipboard ?? defaultWriteClipboard)(url);
  return ok ? { mode: 'clipboard', ok: true } : { mode: 'clipboard', ok: false };
}
