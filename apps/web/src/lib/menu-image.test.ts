import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  clientHostnameFromRequest,
  mapCustomerMenuCatalogImageUrls,
  resolveMenuImageDisplayUrl,
} from './menu-image';

describe('resolveMenuImageDisplayUrl', () => {
  const sample =
    'http://127.0.0.1:54321/storage/v1/object/public/menu-images/r1/item.jpg';

  it('returns null for empty url', () => {
    assert.equal(resolveMenuImageDisplayUrl(null), null);
    assert.equal(resolveMenuImageDisplayUrl(''), null);
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
