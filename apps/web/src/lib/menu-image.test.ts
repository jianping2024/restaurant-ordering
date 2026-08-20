import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MENU_IMAGE_ASPECT_RATIO,
  MENU_IMAGE_OBJECT_FIT_CLASS,
  MENU_IMAGE_WELL_BG_CLASS,
  clientHostnameFromRequest,
  clientPageOriginFromRequest,
  mapCustomerMenuCatalogImageUrls,
  menuImageLetterboxLayout,
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

describe('menuImageLetterboxLayout', () => {
  it('uses sole 4:3 menu aspect', () => {
    assert.equal(MENU_IMAGE_ASPECT_RATIO, 4 / 3);
  });

  it('uses sole contain fit class for display', () => {
    assert.equal(MENU_IMAGE_OBJECT_FIT_CLASS, 'object-contain object-center');
    assert.doesNotMatch(MENU_IMAGE_OBJECT_FIT_CLASS, /object-cover/);
  });

  it('uses sole white well fill matching letterbox canvas', () => {
    assert.equal(MENU_IMAGE_WELL_BG_CLASS, 'bg-white');
    assert.doesNotMatch(MENU_IMAGE_WELL_BG_CLASS, /brand-border/);
  });

  it('pads top/bottom on wider sources (no crop)', () => {
    const r = menuImageLetterboxLayout(1600, 900);
    assert.equal(r.drawW, 1600);
    assert.equal(r.drawH, 900);
    assert.ok(Math.abs(r.outW / r.outH - MENU_IMAGE_ASPECT_RATIO) < 1e-9);
    assert.ok(r.offsetY > 0);
    assert.equal(r.offsetX, 0);
  });

  it('pads left/right on taller sources (no crop)', () => {
    const r = menuImageLetterboxLayout(900, 1600);
    assert.equal(r.drawW, 900);
    assert.equal(r.drawH, 1600);
    assert.ok(Math.abs(r.outW / r.outH - MENU_IMAGE_ASPECT_RATIO) < 1e-9);
    assert.ok(r.offsetX > 0);
    assert.equal(r.offsetY, 0);
  });

  it('keeps full frame when already 4:3', () => {
    const r = menuImageLetterboxLayout(1200, 900);
    assert.deepEqual(r, {
      outW: 1200,
      outH: 900,
      drawW: 1200,
      drawH: 900,
      offsetX: 0,
      offsetY: 0,
    });
  });
});
