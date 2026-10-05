import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MENU_IMAGE_ASPECT_RATIO,
  MENU_IMAGE_OBJECT_FIT_CLASS,
  MENU_IMAGE_WELL_BG_CLASS,
  mapCustomerMenuCatalogImageUrls,
  menuImageLetterboxLayout,
  menuImageObjectPath,
  menuItemImageUrlLookupFromRows,
  pathFromMenuImagePublicUrl,
  resolveMenuImageDisplayUrl,
  toMenuImagePublicRef,
} from './menu-image';
import {
  isLocalHttpMenuImageOrigin,
  toMenuImagePublicRef as sharedToMenuImagePublicRef,
} from '@mesa/shared';

describe('menuImageObjectPath', () => {
  it('nests a unique object key under restaurant and item', () => {
    assert.equal(
      menuImageObjectPath('rid', 'item', 'image/jpeg', 'obj-1'),
      'rid/item/obj-1.jpg',
    );
    assert.equal(
      menuImageObjectPath('rid', 'item', 'image/webp', 'obj-2'),
      'rid/item/obj-2.webp',
    );
  });

  it('round-trips through public URL path extraction', () => {
    const path = menuImageObjectPath('rid', 'item', 'image/png', 'abc');
    const url = `/storage/v1/object/public/menu-images/${path}`;
    assert.equal(pathFromMenuImagePublicUrl(url), path);
  });
});

describe('menuItemImageUrlLookupFromRows', () => {
  it('maps non-empty image_url by menu item id', () => {
    assert.deepEqual(
      menuItemImageUrlLookupFromRows([
        { id: 'a', image_url: ' /storage/v1/object/public/menu-images/a.jpg ' },
        { id: 'b', image_url: null },
        { id: 'c', image_url: '   ' },
        { id: 'd', image_url: 'http://127.0.0.1:54321/storage/v1/object/public/menu-images/d.jpg' },
      ]),
      {
        a: '/storage/v1/object/public/menu-images/a.jpg',
        d: 'http://127.0.0.1:54321/storage/v1/object/public/menu-images/d.jpg',
      },
    );
  });
});

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

  it('writes root-relative for local HTTP published origin without same-origin flag', () => {
    const prevSame = process.env.NEXT_PUBLIC_MESA_SUPABASE_SAME_ORIGIN;
    const prevPub = process.env.SUPABASE_PUBLIC_URL;
    const prevNext = process.env.NEXT_PUBLIC_SUPABASE_URL;
    try {
      delete process.env.NEXT_PUBLIC_MESA_SUPABASE_SAME_ORIGIN;
      delete process.env.SUPABASE_PUBLIC_URL;
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
      assert.equal(isLocalHttpMenuImageOrigin('http://127.0.0.1:54321'), true);
      assert.equal(toMenuImagePublicRef('r1/item.jpg'), '/storage/v1/object/public/menu-images/r1/item.jpg');
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://172.20.10.2:54321';
      assert.equal(toMenuImagePublicRef('r1/item.jpg'), '/storage/v1/object/public/menu-images/r1/item.jpg');
    } finally {
      if (prevSame === undefined) delete process.env.NEXT_PUBLIC_MESA_SUPABASE_SAME_ORIGIN;
      else process.env.NEXT_PUBLIC_MESA_SUPABASE_SAME_ORIGIN = prevSame;
      if (prevPub === undefined) delete process.env.SUPABASE_PUBLIC_URL;
      else process.env.SUPABASE_PUBLIC_URL = prevPub;
      if (prevNext === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      else process.env.NEXT_PUBLIC_SUPABASE_URL = prevNext;
    }
  });
});

describe('resolveMenuImageDisplayUrl', () => {
  const sample =
    'http://127.0.0.1:54321/storage/v1/object/public/menu-images/r1/item.jpg';
  const relative = '/storage/v1/object/public/menu-images/r1/item.jpg';

  it('returns null for empty url', () => {
    assert.equal(resolveMenuImageDisplayUrl(null), null);
    assert.equal(resolveMenuImageDisplayUrl(''), null);
  });

  it('keeps root-relative storage paths', () => {
    assert.equal(resolveMenuImageDisplayUrl(relative), relative);
  });

  it('strips local absolute hosts to root-relative', () => {
    assert.equal(resolveMenuImageDisplayUrl(sample), relative);
    assert.equal(
      resolveMenuImageDisplayUrl(
        'http://172.20.10.4:54321/storage/v1/object/public/menu-images/r1/item.jpg',
      ),
      relative,
    );
    assert.equal(
      resolveMenuImageDisplayUrl(
        'http://localhost:54321/storage/v1/object/public/menu-images/r1/item.jpg',
      ),
      relative,
    );
  });

  it('leaves cloud supabase urls unchanged', () => {
    const cloud =
      'https://abc.supabase.co/storage/v1/object/public/menu-images/r1/item.jpg';
    assert.equal(resolveMenuImageDisplayUrl(cloud), cloud);
  });
});

describe('mapCustomerMenuCatalogImageUrls', () => {
  it('normalizes each menu item image_url to root-relative for local storage', () => {
    const catalog = {
      menuItems: [
        {
          image_url:
            'http://127.0.0.1:54321/storage/v1/object/public/menu-images/r1/a.jpg',
        },
      ],
      menuCategories: [],
    };
    const mapped = mapCustomerMenuCatalogImageUrls(catalog);
    assert.equal(
      mapped.menuItems[0]?.image_url,
      '/storage/v1/object/public/menu-images/r1/a.jpg',
    );
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
