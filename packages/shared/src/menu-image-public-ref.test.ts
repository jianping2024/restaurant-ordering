import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  menuImageSameOriginEnabled,
  toMenuImagePublicRef,
} from './menu-image-public-ref';

describe('menuImageSameOriginEnabled', () => {
  it('accepts 1/true/yes', () => {
    assert.equal(menuImageSameOriginEnabled({ NEXT_PUBLIC_MESA_SUPABASE_SAME_ORIGIN: '1' }), true);
    assert.equal(menuImageSameOriginEnabled({ NEXT_PUBLIC_MESA_SUPABASE_SAME_ORIGIN: 'true' }), true);
    assert.equal(menuImageSameOriginEnabled({ NEXT_PUBLIC_MESA_SUPABASE_SAME_ORIGIN: 'YES' }), true);
  });

  it('rejects unset and other values', () => {
    assert.equal(menuImageSameOriginEnabled({}), false);
    assert.equal(menuImageSameOriginEnabled({ NEXT_PUBLIC_MESA_SUPABASE_SAME_ORIGIN: '0' }), false);
  });
});

describe('toMenuImagePublicRef', () => {
  it('writes root-relative for same-origin Mode B', () => {
    assert.equal(
      toMenuImagePublicRef('rid/item.jpg', { sameOrigin: true, publishedOrigin: 'https://ignored.example' }),
      '/storage/v1/object/public/menu-images/rid/item.jpg',
    );
  });

  it('writes absolute under published origin otherwise', () => {
    assert.equal(
      toMenuImagePublicRef('rid/item.jpg', {
        sameOrigin: false,
        publishedOrigin: 'https://abc.supabase.co/',
      }),
      'https://abc.supabase.co/storage/v1/object/public/menu-images/rid/item.jpg',
    );
  });

  it('strips leading slashes on object path', () => {
    assert.equal(
      toMenuImagePublicRef('/rid/item.png', { sameOrigin: true, publishedOrigin: '' }),
      '/storage/v1/object/public/menu-images/rid/item.png',
    );
  });
});
