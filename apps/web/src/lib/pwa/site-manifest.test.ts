import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PRODUCT_NAME } from '@mesa/shared';
import {
  PWA_BACKGROUND_COLOR,
  PWA_ICON_PATHS,
  PWA_START_URL,
  PWA_THEME_COLOR,
  buildGuestTableManifest,
  buildSiteManifest,
  formatGuestTableWindowTitle,
} from './site-manifest.ts';
import {
  PWA_GUEST_TABLE_MANIFEST_PATH,
  guestTableManifestHref,
  guestTableMenuStartUrl,
} from './guest-table-pwa-manifest.ts';

const TABLE_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

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

describe('guest table PWA manifest', () => {
  it('builds menu start_url and manifest href from slug + table_id only', () => {
    assert.equal(
      guestTableMenuStartUrl('demo', TABLE_ID),
      `/demo/menu?table_id=${TABLE_ID}`,
    );
    assert.equal(
      guestTableManifestHref('demo', TABLE_ID),
      `${PWA_GUEST_TABLE_MANIFEST_PATH}?slug=demo&table_id=${TABLE_ID}`,
    );
    assert.equal(guestTableMenuStartUrl('', TABLE_ID), null);
    assert.equal(guestTableMenuStartUrl('demo', 'not-a-uuid'), null);
    assert.equal(guestTableManifestHref('demo', 'bad'), null);
  });

  it('guest install identity uses table label and guest start_url (not dashboard)', () => {
    const startUrl = guestTableMenuStartUrl('demo', TABLE_ID)!;
    const manifest = buildGuestTableManifest({
      restaurantName: 'Demo Sushi',
      tableDisplayName: 'T5',
      startUrl,
    });
    assert.equal(manifest.start_url, startUrl);
    assert.notEqual(manifest.start_url, PWA_START_URL);
    assert.equal(manifest.short_name, 'T5');
    assert.equal(manifest.name, 'Demo Sushi · T5');
    assert.equal(
      manifest.name,
      formatGuestTableWindowTitle({
        restaurantName: 'Demo Sushi',
        tableDisplayName: 'T5',
      }),
    );
    assert.equal(manifest.handle_links, 'not-preferred');
    assert.equal(manifest.display, 'standalone');
    assert.deepEqual(
      (manifest.icons ?? []).map((i) => i.src),
      Object.values(PWA_ICON_PATHS),
    );
  });

  it('formatGuestTableWindowTitle is 店名 · 桌号, or 店名 alone without table', () => {
    assert.equal(
      formatGuestTableWindowTitle({
        restaurantName: 'Washoku Sushi',
        tableDisplayName: '1',
      }),
      'Washoku Sushi · 1',
    );
    assert.equal(
      formatGuestTableWindowTitle({ restaurantName: 'Washoku Sushi' }),
      'Washoku Sushi',
    );
    assert.equal(
      formatGuestTableWindowTitle({ restaurantName: '  ', tableDisplayName: null }),
      PRODUCT_NAME,
    );
  });
});
