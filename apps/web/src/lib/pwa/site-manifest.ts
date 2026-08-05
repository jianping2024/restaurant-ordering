import type { MetadataRoute } from 'next';
import { PRODUCT_NAME, PRODUCT_SITE_DESCRIPTION_ZH } from '@mesa/shared';

/** Matches apps/web/src/app/globals.css dark theme brand-bg (`#0F0E0C`). */
export const PWA_THEME_COLOR = '#0F0E0C';

/** Splash / install canvas — same as theme for a consistent home-screen handoff. */
export const PWA_BACKGROUND_COLOR = PWA_THEME_COLOR;

/** Sole icon path table — manifest icons + launch-shell mark. */
export const PWA_ICON_PATHS = {
  any192: '/icons/icon-192.png',
  any512: '/icons/icon-512.png',
  maskable512: '/icons/icon-512-maskable.png',
} as const;

/** Cold-start entry: dashboard so logged-in staff skip login→redirect hop. */
export const PWA_START_URL = '/dashboard';

/**
 * Install-only staff shell: keep full-origin scope so in-app staff navigation
 * (incl. assisted `/{slug}/menu`) stays in the standalone window, but tell the UA
 * not to capture browser/QR navigations into the installed app.
 * @see https://github.com/WICG/pwa-url-handler/blob/main/handle_links/explainer.md
 */
export type PwaHandleLinks = 'auto' | 'preferred' | 'not-preferred';

/** Web App Manifest fields — single source for manifest.ts. */
export type SiteManifest = MetadataRoute.Manifest & {
  handle_links: PwaHandleLinks;
};

export function buildSiteManifest(): SiteManifest {
  return {
    name: PRODUCT_NAME,
    short_name: PRODUCT_NAME,
    description: PRODUCT_SITE_DESCRIPTION_ZH,
    start_url: PWA_START_URL,
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    theme_color: PWA_THEME_COLOR,
    background_color: PWA_BACKGROUND_COLOR,
    handle_links: 'not-preferred',
    icons: [
      {
        src: PWA_ICON_PATHS.any192,
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: PWA_ICON_PATHS.any512,
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: PWA_ICON_PATHS.maskable512,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
