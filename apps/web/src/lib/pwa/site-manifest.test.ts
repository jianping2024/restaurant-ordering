import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PRODUCT_NAME } from '@mesa/shared';
import {
  PWA_BACKGROUND_COLOR,
  PWA_ICON_PATHS,
  PWA_START_URL,
  PWA_THEME_COLOR,
  buildSiteManifest,
} from './site-manifest.ts';

describe('buildSiteManifest', () => {
  it('cold-starts at dashboard (logged-in skips login hop)', () => {
    const manifest = buildSiteManifest();
    assert.equal(manifest.start_url, PWA_START_URL);
    assert.equal(PWA_START_URL, '/dashboard');
    assert.equal(manifest.scope, '/');
    assert.equal(manifest.display, 'standalone');
    assert.equal(manifest.handle_links, 'not-preferred');
    assert.equal(manifest.name, PRODUCT_NAME);
    assert.equal(manifest.short_name, PRODUCT_NAME);
  });

  it('exposes required PWA icons including maskable from one path table', () => {
    const manifest = buildSiteManifest();
    const icons = manifest.icons ?? [];
    const bySrc = Object.fromEntries(icons.map((icon) => [icon.src, icon]));
    assert.equal(bySrc[PWA_ICON_PATHS.any192]?.sizes, '192x192');
    assert.equal(bySrc[PWA_ICON_PATHS.any512]?.sizes, '512x512');
    assert.equal(bySrc[PWA_ICON_PATHS.maskable512]?.purpose, 'maskable');
    assert.equal(PWA_BACKGROUND_COLOR, PWA_THEME_COLOR);
    assert.equal(manifest.theme_color, PWA_THEME_COLOR);
    assert.equal(manifest.background_color, PWA_BACKGROUND_COLOR);
  });
});
