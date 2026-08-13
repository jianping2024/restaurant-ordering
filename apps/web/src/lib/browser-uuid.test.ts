import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mintBrowserUuid } from './browser-uuid';
import { parseAppendClientRequestId } from './append-idempotency';
import { parseGuestClientId } from './table-order-round/guest-client';

const REQUEST_ID = '11111111-1111-4111-8111-111111111111';

describe('mintBrowserUuid', () => {
  it('mints RFC4122 v4 via getRandomValues when randomUUID is missing', () => {
    const original = globalThis.crypto;
    const seed = Uint8Array.from({ length: 16 }, (_, i) => i);
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: {
        getRandomValues(target: Uint8Array) {
          target.set(seed);
          return target;
        },
      },
    });
    try {
      const id = mintBrowserUuid();
      assert.equal(id, '00010203-0405-4607-8809-0a0b0c0d0e0f');
      assert.equal(parseAppendClientRequestId(id), id);
      assert.equal(parseGuestClientId(id), id);
    } finally {
      Object.defineProperty(globalThis, 'crypto', {
        configurable: true,
        value: original,
      });
    }
  });

  it('prefers randomUUID when available', () => {
    const original = globalThis.crypto;
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: {
        randomUUID: () => REQUEST_ID,
        getRandomValues() {
          throw new Error('getRandomValues should not run');
        },
      },
    });
    try {
      assert.equal(mintBrowserUuid(), REQUEST_ID);
    } finally {
      Object.defineProperty(globalThis, 'crypto', {
        configurable: true,
        value: original,
      });
    }
  });

  it('throws when crypto uuid APIs are unavailable', () => {
    const original = globalThis.crypto;
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: {},
    });
    try {
      assert.throws(() => mintBrowserUuid(), /crypto_uuid_unavailable/);
    } finally {
      Object.defineProperty(globalThis, 'crypto', {
        configurable: true,
        value: original,
      });
    }
  });
});
