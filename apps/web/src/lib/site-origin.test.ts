import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getPublicWebOrigin } from './site-origin.ts';

describe('getPublicWebOrigin', () => {
  it('prefers request Host over browser location and NEXT_PUBLIC_BASE_URL', () => {
    const prevLoc = (globalThis as { location?: unknown }).location;
    (globalThis as { location?: { origin: string } }).location = {
      origin: 'http://localhost:3000',
    };
    const prevBase = process.env.NEXT_PUBLIC_BASE_URL;
    process.env.NEXT_PUBLIC_BASE_URL = 'http://192.168.0.141';
    try {
      const headers = {
        get(name: string) {
          if (name === 'x-forwarded-host') return 'pirata.example.com';
          if (name === 'x-forwarded-proto') return 'https';
          return null;
        },
      };
      assert.equal(getPublicWebOrigin(headers), 'https://pirata.example.com');
    } finally {
      if (prevLoc === undefined) delete (globalThis as { location?: unknown }).location;
      else (globalThis as { location?: unknown }).location = prevLoc;
      if (prevBase === undefined) delete process.env.NEXT_PUBLIC_BASE_URL;
      else process.env.NEXT_PUBLIC_BASE_URL = prevBase;
    }
  });

  it('uses browser location when no request headers', () => {
    const prevLoc = (globalThis as { location?: unknown }).location;
    (globalThis as { location?: { origin: string } }).location = {
      origin: 'https://pirata.example.com',
    };
    const prevBase = process.env.NEXT_PUBLIC_BASE_URL;
    process.env.NEXT_PUBLIC_BASE_URL = 'http://192.168.0.141';
    try {
      assert.equal(getPublicWebOrigin(), 'https://pirata.example.com');
    } finally {
      if (prevLoc === undefined) delete (globalThis as { location?: unknown }).location;
      else (globalThis as { location?: unknown }).location = prevLoc;
      if (prevBase === undefined) delete process.env.NEXT_PUBLIC_BASE_URL;
      else process.env.NEXT_PUBLIC_BASE_URL = prevBase;
    }
  });

  it('falls back to NEXT_PUBLIC_BASE_URL then localhost', () => {
    const prevLoc = (globalThis as { location?: unknown }).location;
    delete (globalThis as { location?: unknown }).location;
    const prevBase = process.env.NEXT_PUBLIC_BASE_URL;
    try {
      process.env.NEXT_PUBLIC_BASE_URL = 'http://192.168.0.141/';
      assert.equal(getPublicWebOrigin(), 'http://192.168.0.141');
      delete process.env.NEXT_PUBLIC_BASE_URL;
      assert.equal(getPublicWebOrigin(), 'http://localhost:3000');
    } finally {
      if (prevLoc === undefined) delete (globalThis as { location?: unknown }).location;
      else (globalThis as { location?: unknown }).location = prevLoc;
      if (prevBase === undefined) delete process.env.NEXT_PUBLIC_BASE_URL;
      else process.env.NEXT_PUBLIC_BASE_URL = prevBase;
    }
  });
});
