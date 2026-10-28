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

/** Staff cold-start entry: dashboard so logged-in staff skip login→redirect hop. */
export const PWA_START_URL = '/dashboard';

/**
 * Install-only staff shell: keep full-origin scope so in-app staff navigation
 * (incl. assisted `/{slug}/menu`) stays in the standalone window, but tell the UA
 * not to capture browser/QR navigations into the installed app.
 * @see https://github.com/WICG/pwa-url-handler/blob/main/handle_links/explainer.md
 */
export type PwaHandleLinks = 'auto' | 'preferred' | 'not-preferred';

/** Web App Manifest fields — single source for staff + guest-table manifests. */
export type SiteManifest = MetadataRoute.Manifest & {
  handle_links: PwaHandleLinks;
};

function buildManifestIcons(): NonNullable<MetadataRoute.Manifest['icons']> {
  return [
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
  ];
}

function buildManifestShell(fields: {
  name: string;
  short_name: string;
  start_url: string;
}): SiteManifest {
  return {
    name: fields.name,
    short_name: fields.short_name,
    description: PRODUCT_SITE_DESCRIPTION_ZH,
    start_url: fields.start_url,
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    theme_color: PWA_THEME_COLOR,
    background_color: PWA_BACKGROUND_COLOR,
    handle_links: 'not-preferred',
    icons: buildManifestIcons(),
  };
}

/** Staff / default site manifest (`app/manifest.ts`). */
export function buildSiteManifest(): SiteManifest {
  return buildManifestShell({
    name: PRODUCT_NAME,
    short_name: PRODUCT_NAME,
    start_url: PWA_START_URL,
  });
}

export type GuestTableManifestInput = {
  restaurantName: string;
  tableDisplayName: string;
  /** Must be the output of `guestTableMenuStartUrl` (guest-table-pwa-manifest). */
  startUrl: string;
};

/** Per-table guest install identity — home-screen name is the table label. */
export function buildGuestTableManifest(input: GuestTableManifestInput): SiteManifest {
  const tableLabel = input.tableDisplayName.trim() || PRODUCT_NAME;
  const restaurant = input.restaurantName.trim() || PRODUCT_NAME;
  return buildManifestShell({
    name: `${restaurant} · ${tableLabel}`,
    short_name: tableLabel,
    start_url: input.startUrl,
  });
}
