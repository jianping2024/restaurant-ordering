import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { PWA_ICON_PATHS } from './site-manifest.ts';
import {
  PWA_SHELL_CACHE_PREFIX,
  PWA_SHELL_SW_PATH,
  buildPwaShellServiceWorkerScript,
  normalizePwaShellSwVersion,
  pwaShellCacheName,
  pwaShellPrecacheUrls,
  pwaShellSwRegisterUrl,
} from './shell-sw.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const layoutSource = readFileSync(join(root, 'app/layout.tsx'), 'utf8');
const routeSource = readFileSync(
  join(root, 'app/mesa-pwa-shell-sw.js/route.ts'),
  'utf8',
);
const registerSource = readFileSync(
  join(root, 'components/pwa/PwaShellSwRegister.tsx'),
  'utf8',
);

describe('pwa shell sw — one representation', () => {
  it('normalizes empty version to dev and builds one cache name / register URL', () => {
    assert.equal(normalizePwaShellSwVersion(''), 'dev');
    assert.equal(normalizePwaShellSwVersion(undefined), 'dev');
    assert.equal(pwaShellCacheName('abc'), `${PWA_SHELL_CACHE_PREFIX}:abc`);
    assert.equal(pwaShellCacheName(''), `${PWA_SHELL_CACHE_PREFIX}:dev`);
    assert.equal(PWA_SHELL_SW_PATH, '/mesa-pwa-shell-sw.js');
    assert.equal(
      pwaShellSwRegisterUrl('1.2.3'),
      '/mesa-pwa-shell-sw.js?v=1.2.3',
    );
  });

  it('precache list is only PWA_ICON_PATHS values', () => {
    assert.deepEqual(pwaShellPrecacheUrls(), [...Object.values(PWA_ICON_PATHS)]);
  });

  it('generated script never caches /api and uses cache-then-network for navigations', () => {
    const script = buildPwaShellServiceWorkerScript('test-build');
    assert.match(script, /mesa-pwa-shell:test-build/);
    assert.match(script, /pathname\.startsWith\('\/api\/'\)/);
    assert.match(script, /navigateCacheThenNetwork/);
    assert.match(script, /skipWaiting/);
    assert.match(script, /clients\.claim/);
    assert.equal(script.includes('caches.open') && script.includes('/api/'), true);
    // Must not put API responses: early-return when isApi
    assert.match(script, /isApi\(url\)\) return/);
    assert.match(script, /hot-update/);
    for (const icon of Object.values(PWA_ICON_PATHS)) {
      assert.match(script, new RegExp(icon.replace(/\//g, '\\/')));
    }
  });

  it('layout/route/register/middleware wire the sole builder and path (no public/*.js twin)', () => {
    assert.match(routeSource, /buildPwaShellServiceWorkerScript/);
    assert.match(routeSource, /getWebAppBuildInfo/);
    assert.match(routeSource, /Service-Worker-Allowed/);
    assert.match(registerSource, /pwaShellSwRegisterUrl/);
    assert.match(registerSource, /serviceWorker\.register/);
    assert.match(layoutSource, /PwaShellSwRegister/);
    assert.match(layoutSource, /getWebAppBuildInfo/);
    assert.equal(layoutSource.includes('navigator.serviceWorker'), false);
    assert.equal(routeSource.includes('public/'), false);
    const policySource = readFileSync(
      join(root, 'lib/supabase/middleware-session-policy.ts'),
      'utf8',
    );
    assert.match(policySource, /PWA_SHELL_SW_PATH/);
    assert.equal(policySource.includes("'/mesa-pwa-shell-sw.js'"), false);
  });
});
