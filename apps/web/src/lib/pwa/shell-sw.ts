/**
 * Install-only PWA app-shell Service Worker — one representation.
 *
 * - Script body: {@link buildPwaShellServiceWorkerScript} only
 * - Register URL / cache name / path: exports below only
 * - Precache list: {@link PWA_ICON_PATHS} only (site-manifest)
 * - Build id: **only** `getWebAppBuildInfo().version` from callers (health / settings /
 *   layout / SW route share that getter). Empty → cache label `dev`. No MESA_PWA_* twin.
 *
 * Not offline POS: never caches `/api/*`. Navigations use cache-then-network
 * (instant repeat cold-start paint; network updates the shell).
 */
import { PWA_ICON_PATHS } from '@/lib/pwa/site-manifest';

/** Sole public path for the shell SW (App Router route + register). */
export const PWA_SHELL_SW_PATH = '/mesa-pwa-shell-sw.js';

/** Cache key prefix — activate deletes other `mesa-pwa-shell:*` entries. */
export const PWA_SHELL_CACHE_PREFIX = 'mesa-pwa-shell';

export function normalizePwaShellSwVersion(version: string | null | undefined): string {
  const trimmed = version?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : 'dev';
}

export function pwaShellCacheName(version: string | null | undefined): string {
  return `${PWA_SHELL_CACHE_PREFIX}:${normalizePwaShellSwVersion(version)}`;
}

/** Register URL — `?v=` busts the browser’s SW script cache; body version must match. */
export function pwaShellSwRegisterUrl(version: string | null | undefined): string {
  const v = normalizePwaShellSwVersion(version);
  return `${PWA_SHELL_SW_PATH}?v=${encodeURIComponent(v)}`;
}

/** Precache URLs — sole list, derived from manifest icon table. */
export function pwaShellPrecacheUrls(): string[] {
  return [...Object.values(PWA_ICON_PATHS)];
}

/**
 * Sole SW source text. Served by `app/mesa-pwa-shell-sw.js/route.ts` only —
 * do not hand-maintain a parallel `public/*.js` worker.
 */
export function buildPwaShellServiceWorkerScript(version: string | null | undefined): string {
  const cacheName = JSON.stringify(pwaShellCacheName(version));
  const prefix = JSON.stringify(`${PWA_SHELL_CACHE_PREFIX}:`);
  const precache = JSON.stringify(pwaShellPrecacheUrls());

  return `/* mesa-pwa-shell — generated; do not edit */
(() => {
  const CACHE = ${cacheName};
  const PREFIX = ${prefix};
  const PRECACHE = ${precache};

  self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
      const cache = await caches.open(CACHE);
      await Promise.all(
        PRECACHE.map((url) =>
          cache.add(url).catch(() => undefined),
        ),
      );
      await self.skipWaiting();
    })());
  });

  self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith(PREFIX) && key !== CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })());
  });

  function sameOrigin(url) {
    return url.origin === self.location.origin;
  }

  function isApi(url) {
    return url.pathname === '/api' || url.pathname.startsWith('/api/');
  }

  function isStaticAsset(url) {
    return (
      url.pathname.startsWith('/_next/static/') ||
      PRECACHE.indexOf(url.pathname) !== -1
    );
  }

  function canPut(response) {
    return response && response.ok && response.type === 'basic';
  }

  async function putClone(cache, request, response) {
    if (!canPut(response)) return;
    try {
      await cache.put(request, response.clone());
    } catch (_) {
      /* opaque / quota — fail open */
    }
  }

  async function cacheFirst(request) {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(request);
    if (hit) return hit;
    const response = await fetch(request);
    await putClone(cache, request, response);
    return response;
  }

  async function networkFirst(request) {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(request);
      await putClone(cache, request, response);
      return response;
    } catch (err) {
      const hit = await cache.match(request);
      if (hit) return hit;
      throw err;
    }
  }

  /** Repeat cold-start: paint cached document immediately; refresh cache from network. */
  async function navigateCacheThenNetwork(request) {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(request);
    const networkPromise = fetch(request)
      .then(async (response) => {
        await putClone(cache, request, response);
        return response;
      })
      .catch((err) => {
        if (hit) return hit;
        throw err;
      });
    if (hit) {
      void networkPromise;
      return hit;
    }
    return networkPromise;
  }

  self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET') return;
    let url;
    try {
      url = new URL(request.url);
    } catch (_) {
      return;
    }
    if (!sameOrigin(url) || isApi(url)) return;
    // Never shell-cache Next HMR payloads (dev-only noise / stale patches).
    if (url.pathname.includes('hot-update')) return;

    if (isStaticAsset(url)) {
      event.respondWith(cacheFirst(request));
      return;
    }

    const acceptsHtml = (request.headers.get('accept') || '').includes('text/html');
    if (request.mode === 'navigate' || acceptsHtml) {
      event.respondWith(navigateCacheThenNetwork(request));
      return;
    }

    event.respondWith(networkFirst(request));
  });
})();
`;
}
