import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  getPublishedSupabaseUrl,
  getSupabaseAuthCookieOptions,
  getSupabaseUrl,
  isSupabaseBrowserSameOrigin,
} from './url';

const KEYS = [
  'NEXT_PUBLIC_MESA_SUPABASE_SAME_ORIGIN',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_URL',
  'SUPABASE_PUBLIC_URL',
  'NEXT_PUBLIC_BASE_URL',
] as const;

const saved: Record<string, string | undefined> = {};

function stashEnv() {
  for (const k of KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
}

function restoreEnv() {
  for (const k of KEYS) {
    const v = saved[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

afterEach(() => {
  restoreEnv();
});

describe('isSupabaseBrowserSameOrigin', () => {
  it('is false by default (cloud / local CLI)', () => {
    stashEnv();
    assert.equal(isSupabaseBrowserSameOrigin(), false);
  });

  it('is true when NEXT_PUBLIC_MESA_SUPABASE_SAME_ORIGIN=1', () => {
    stashEnv();
    process.env.NEXT_PUBLIC_MESA_SUPABASE_SAME_ORIGIN = '1';
    assert.equal(isSupabaseBrowserSameOrigin(), true);
  });
});

describe('getSupabaseUrl (server)', () => {
  it('prefers SUPABASE_URL over NEXT_PUBLIC (on-prem kong)', () => {
    stashEnv();
    process.env.SUPABASE_URL = 'http://kong:8000';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1';
    assert.equal(getSupabaseUrl(), 'http://kong:8000');
  });

  it('falls back to NEXT_PUBLIC_SUPABASE_URL (cloud)', () => {
    stashEnv();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abc.supabase.co';
    assert.equal(getSupabaseUrl(), 'https://abc.supabase.co');
  });
});

describe('getSupabaseUrl (browser same-origin)', () => {
  it('uses window.location.origin when SAME_ORIGIN flag is set', () => {
    stashEnv();
    process.env.NEXT_PUBLIC_MESA_SUPABASE_SAME_ORIGIN = '1';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://192.168.0.141';
    const prevWindow = (globalThis as { window?: unknown }).window;
    (globalThis as { window?: { location: { origin: string } } }).window = {
      location: { origin: 'https://pirata.farvoo.com' },
    };
    try {
      assert.equal(getSupabaseUrl(), 'https://pirata.farvoo.com');
    } finally {
      if (prevWindow === undefined) delete (globalThis as { window?: unknown }).window;
      else (globalThis as { window?: unknown }).window = prevWindow;
    }
  });
});

describe('getSupabaseAuthCookieOptions', () => {
  it('is undefined when same-origin is off (cloud / local CLI)', () => {
    stashEnv();
    assert.equal(getSupabaseAuthCookieOptions(), undefined);
  });

  it('pins sb-kong-auth-token when same-origin is on (Mode B)', () => {
    stashEnv();
    process.env.NEXT_PUBLIC_MESA_SUPABASE_SAME_ORIGIN = '1';
    assert.deepEqual(getSupabaseAuthCookieOptions(), {
      name: 'sb-kong-auth-token',
    });
  });
});

describe('getPublishedSupabaseUrl', () => {
  it('prefers SUPABASE_PUBLIC_URL (edge origin)', () => {
    stashEnv();
    process.env.SUPABASE_PUBLIC_URL = 'https://pirata.farvoo.com';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abc.supabase.co';
    assert.equal(getPublishedSupabaseUrl(), 'https://pirata.farvoo.com');
  });

  it('uses NEXT_PUBLIC_SUPABASE_URL when no SUPABASE_PUBLIC_URL (cloud)', () => {
    stashEnv();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abc.supabase.co';
    assert.equal(getPublishedSupabaseUrl(), 'https://abc.supabase.co');
  });
});
