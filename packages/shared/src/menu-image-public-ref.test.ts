import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isLocalHttpMenuImageOrigin,
  menuImageSameOriginEnabled,
  toMenuImagePublicRef,
} from './menu-image-public-ref';

describe('menuImageSameOriginEnabled', () => {
  it('accepts 1/true/yes via injected env (tests / scripts)', () => {
    assert.equal(menuImageSameOriginEnabled({ NEXT_PUBLIC_MESA_SUPABASE_SAME_ORIGIN: '1' }), true);
    assert.equal(menuImageSameOriginEnabled({ NEXT_PUBLIC_MESA_SUPABASE_SAME_ORIGIN: 'true' }), true);
    assert.equal(menuImageSameOriginEnabled({ NEXT_PUBLIC_MESA_SUPABASE_SAME_ORIGIN: 'YES' }), true);
  });

  it('rejects unset and other values via injected env', () => {
    assert.equal(menuImageSameOriginEnabled({}), false);
    assert.equal(menuImageSameOriginEnabled({ NEXT_PUBLIC_MESA_SUPABASE_SAME_ORIGIN: '0' }), false);
  });

  it('no-arg path reads process.env.NEXT_PUBLIC_MESA_SUPABASE_SAME_ORIGIN (Next inline)', () => {
    const prev = process.env.NEXT_PUBLIC_MESA_SUPABASE_SAME_ORIGIN;
    try {
      process.env.NEXT_PUBLIC_MESA_SUPABASE_SAME_ORIGIN = '1';
      assert.equal(menuImageSameOriginEnabled(), true);
      process.env.NEXT_PUBLIC_MESA_SUPABASE_SAME_ORIGIN = '0';
      assert.equal(menuImageSameOriginEnabled(), false);
      delete process.env.NEXT_PUBLIC_MESA_SUPABASE_SAME_ORIGIN;
      assert.equal(menuImageSameOriginEnabled(), false);
    } finally {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_MESA_SUPABASE_SAME_ORIGIN;
      else process.env.NEXT_PUBLIC_MESA_SUPABASE_SAME_ORIGIN = prev;
    }
  });
});

describe('isLocalHttpMenuImageOrigin', () => {
  it('accepts loopback and docker host http origins', () => {
    assert.equal(isLocalHttpMenuImageOrigin('http://127.0.0.1:54321'), true);
    assert.equal(isLocalHttpMenuImageOrigin('http://localhost:54321'), true);
    assert.equal(isLocalHttpMenuImageOrigin('http://host.docker.internal:54321'), true);
  });

  it('accepts RFC1918 http origins', () => {
    assert.equal(isLocalHttpMenuImageOrigin('http://172.20.10.2:54321'), true);
    assert.equal(isLocalHttpMenuImageOrigin('http://192.168.1.5:54321'), true);
    assert.equal(isLocalHttpMenuImageOrigin('http://10.0.0.2:8000'), true);
  });

  it('rejects cloud https and non-private hosts', () => {
    assert.equal(isLocalHttpMenuImageOrigin('https://abc.supabase.co'), false);
    assert.equal(isLocalHttpMenuImageOrigin('http://example.com'), false);
    assert.equal(isLocalHttpMenuImageOrigin('not-a-url'), false);
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
