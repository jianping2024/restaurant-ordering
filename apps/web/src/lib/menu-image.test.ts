import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MENU_IMAGE_ASPECT_RATIO,
  clientHostnameFromRequest,
  clientPageOriginFromRequest,
  mapCustomerMenuCatalogImageUrls,
  menuImageCenterCropRect,
  resolveMenuImageDisplayUrl,
  toMenuImagePublicRef,
} from './menu-image';
import { toMenuImagePublicRef as sharedToMenuImagePublicRef } from '@mesa/shared';

describe('toMenuImagePublicRef (app binder)', () => {
  it('delegates to shared formatter under cloud env', () => {
    const prevSame = process.env.NEXT_PUBLIC_MESA_SUPABASE_SAME_ORIGIN;
    const prevPub = process.env.SUPABASE_PUBLIC_URL;
    const prevNext = process.env.NEXT_PUBLIC_SUPABASE_URL;
    try {
      delete process.env.NEXT_PUBLIC_MESA_SUPABASE_SAME_ORIGIN;
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abc.supabase.co';
      delete process.env.SUPABASE_PUBLIC_URL;
      assert.equal(
        toMenuImagePublicRef('r1/item.jpg'),
        sharedToMenuImagePublicRef('r1/item.jpg', {
          sameOrigin: false,
          publishedOrigin: 'https://abc.supabase.co',
        }),
      );
      assert.equal(
        toMenuImagePublicRef('r1/item.jpg'),
        'https://abc.supabase.co/storage/v1/object/public/menu-images/r1/item.jpg',
      );
    } finally {
      if (prevSame === undefined) delete process.env.NEXT_PUBLIC_MESA_SUPABASE_SAME_ORIGIN;
      else process.env.NEXT_PUBLIC_MESA_SUPABASE_SAME_ORIGIN = prevSame;
      if (prevPub === undefined) delete process.env.SUPABASE_PUBLIC_URL;
      else process.env.SUPABASE_PUBLIC_URL = prevPub;
      if (prevNext === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      else process.env.NEXT_PUBLIC_SUPABASE_URL = prevNext;
    }
  });

  it('writes root-relative when same-origin flag is set', () => {
    const prevSame = process.env.NEXT_PUBLIC_MESA_SUPABASE_SAME_ORIGIN;
    const prevNext = process.env.NEXT_PUBLIC_SUPABASE_URL;
    try {
      process.env.NEXT_PUBLIC_MESA_SUPABASE_SAME_ORIGIN = '1';
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://ignored.supabase.co';
      assert.equal(toMenuImagePublicRef('r1/item.jpg'), '/storage/v1/object/public/menu-images/r1/item.jpg');
    } finally {
      if (prevSame === undefined) delete process.env.NEXT_PUBLIC_MESA_SUPABASE_SAME_ORIGIN;
      else process.env.NEXT_PUBLIC_MESA_SUPABASE_SAME_ORIGIN = prevSame;
      if (prevNext === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      else process.env.NEXT_PUBLIC_SUPABASE_URL = prevNext;
    }
  });
});

describe('resolveMenuImageDisplayUrl', () => {
  const sample =
    'http://127.0.0.1:54321/storage/v1/object/public/menu-images/r1/item.jpg';

  it('returns null for empty url', () => {
    assert.equal(resolveMenuImageDisplayUrl(null), null);
    assert.equal(resolveMenuImageDisplayUrl(''), null);
  });

  it('keeps root-relative storage paths', () => {
    const rel = '/storage/v1/object/public/menu-images/r1/item.jpg';
    assert.equal(resolveMenuImageDisplayUrl(rel, { clientHostname: 'pirata.farvoo.com' }), rel);
  });

  it('keeps localhost urls when client is on localhost', () => {
    assert.equal(
      resolveMenuImageDisplayUrl(sample, { clientHostname: 'localhost' }),
      sample,
    );
  });

  it('rewrites local supabase origin to lan host for real devices', () => {
    assert.equal(
      resolveMenuImageDisplayUrl(sample, { clientHostname: '172.20.10.4' }),
      'http://172.20.10.4:54321/storage/v1/object/public/menu-images/r1/item.jpg',
    );
  });

  it('leaves cloud supabase urls unchanged', () => {
    const cloud =
      'https://abc.supabase.co/storage/v1/object/public/menu-images/r1/item.jpg';
    assert.equal(
      resolveMenuImageDisplayUrl(cloud, { clientHostname: '172.20.10.4' }),
      cloud,
    );
  });

  it('rewrites absolute menu-images to pageOrigin when same-origin', () => {
    const prev = process.env.NEXT_PUBLIC_MESA_SUPABASE_SAME_ORIGIN;
    try {
      process.env.NEXT_PUBLIC_MESA_SUPABASE_SAME_ORIGIN = '1';
      assert.equal(
        resolveMenuImageDisplayUrl(
          'http://127.0.0.1:8000/storage/v1/object/public/menu-images/r1/a.jpg',
          { pageOrigin: 'https://pirata.farvoo.com' },
        ),
        'https://pirata.farvoo.com/storage/v1/object/public/menu-images/r1/a.jpg',
      );
    } finally {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_MESA_SUPABASE_SAME_ORIGIN;
      else process.env.NEXT_PUBLIC_MESA_SUPABASE_SAME_ORIGIN = prev;
    }
  });
});

describe('mapCustomerMenuCatalogImageUrls', () => {
  it('rewrites each menu item image_url for the client host', () => {
    const catalog = {
      menuItems: [
        {
          image_url:
            'http://127.0.0.1:54321/storage/v1/object/public/menu-images/r1/a.jpg',
        },
      ],
      menuCategories: [],
    };
    const mapped = mapCustomerMenuCatalogImageUrls(catalog, '172.20.10.4');
    assert.match(mapped.menuItems[0]?.image_url ?? '', /172\.20\.10\.4:54321/);
  });
});

describe('clientHostnameFromRequest', () => {
  it('prefers the Host header over the request URL hostname', () => {
    const req = new Request('http://0.0.0.0:3000/api/test', {
      headers: { host: '172.20.10.4:3000' },
    });
    assert.equal(clientHostnameFromRequest(req), '172.20.10.4');
  });
});

describe('clientPageOriginFromRequest', () => {
  it('uses x-forwarded-proto when present', () => {
    const req = new Request('http://0.0.0.0:3000/api/test', {
      headers: { host: 'pirata.farvoo.com', 'x-forwarded-proto': 'https' },
    });
    assert.equal(clientPageOriginFromRequest(req), 'https://pirata.farvoo.com');
  });
});

describe('menuImageCenterCropRect', () => {
  it('uses sole 4:3 menu aspect', () => {
    assert.equal(MENU_IMAGE_ASPECT_RATIO, 4 / 3);
  });

  it('crops left/right on wider sources', () => {
    const r = menuImageCenterCropRect(1600, 900);
    assert.equal(r.sy, 0);
    assert.equal(r.sh, 900);
    assert.ok(Math.abs(r.sw / r.sh - MENU_IMAGE_ASPECT_RATIO) < 1e-9);
    assert.ok(Math.abs(r.sx - (1600 - r.sw) / 2) < 1e-9);
  });

  it('crops top/bottom on taller sources', () => {
    const r = menuImageCenterCropRect(900, 1600);
    assert.equal(r.sx, 0);
    assert.equal(r.sw, 900);
    assert.ok(Math.abs(r.sw / r.sh - MENU_IMAGE_ASPECT_RATIO) < 1e-9);
    assert.ok(Math.abs(r.sy - (1600 - r.sh) / 2) < 1e-9);
  });

  it('keeps full frame when already 4:3', () => {
    const r = menuImageCenterCropRect(1200, 900);
    assert.deepEqual(r, { sx: 0, sy: 0, sw: 1200, sh: 900 });
  });
});
