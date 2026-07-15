import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PRODUCT_NAME } from '@mesa/shared';
import {
  PWA_BACKGROUND_COLOR,
  PWA_THEME_COLOR,
  buildSiteManifest,
} from './site-manifest.ts';

describe('buildSiteManifest', () => {
  it('keeps install entry on shared login (multi-tenant safe)', () => {
    const manifest = buildSiteManifest();
    assert.equal(manifest.start_url, '/auth/login');
    assert.equal(manifest.scope, '/');
    assert.equal(manifest.display, 'standalone');
    assert.equal(manifest.name, PRODUCT_NAME);
    assert.equal(manifest.short_name, PRODUCT_NAME);
  });

  it('exposes required PWA icons including maskable', () => {
    const icons = buildSiteManifest().icons ?? [];
    const bySrc = Object.fromEntries(icons.map((icon) => [icon.src, icon]));
    assert.equal(bySrc['/icons/icon-192.png']?.sizes, '192x192');
    assert.equal(bySrc['/icons/icon-512.png']?.sizes, '512x512');
    assert.equal(bySrc['/icons/icon-512-maskable.png']?.purpose, 'maskable');
    assert.equal(PWA_BACKGROUND_COLOR, PWA_THEME_COLOR);
  });
});
