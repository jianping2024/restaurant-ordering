import type { MetadataRoute } from 'next';
import { PRODUCT_NAME, PRODUCT_SITE_DESCRIPTION_ZH } from '@mesa/shared';

/** Matches apps/web/src/app/globals.css dark theme brand-bg (`#0F0E0C`). */
export const PWA_THEME_COLOR = '#0F0E0C';

/** Splash / install canvas — same as theme for a consistent home-screen handoff. */
export const PWA_BACKGROUND_COLOR = PWA_THEME_COLOR;

const PWA_ICON_PATHS = {
  any192: '/icons/icon-192.png',
  any512: '/icons/icon-512.png',
  maskable512: '/icons/icon-512-maskable.png',
} as const;

/** Web App Manifest fields — single source for manifest.ts. */
export function buildSiteManifest(): MetadataRoute.Manifest {
  return {
    name: PRODUCT_NAME,
    short_name: PRODUCT_NAME,
    description: PRODUCT_SITE_DESCRIPTION_ZH,
    start_url: '/auth/login',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    theme_color: PWA_THEME_COLOR,
    background_color: PWA_BACKGROUND_COLOR,
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
