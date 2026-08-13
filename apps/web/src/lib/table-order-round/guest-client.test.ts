import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ensureGuestClientId,
  guestClientStorageKey,
  parseGuestClientId,
} from './guest-client';

const BAD_LAN_ID = '19ffb63f40c-0000-4000-8000-82dec4650eb1';
const TABLE = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const REST = '11111111-1111-4111-8111-111111111111';

describe('ensureGuestClientId', () => {
  it('remints when stored id is not a UUID', () => {
    const store: Record<string, string> = {
      [guestClientStorageKey(REST, TABLE)]: BAD_LAN_ID,
    };
    const originalWindow = (globalThis as { window?: unknown }).window;
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        localStorage: {
          getItem: (k: string) => store[k] ?? null,
          setItem: (k: string, v: string) => {
            store[k] = v;
          },
        },
      },
    });
    try {
      assert.equal(parseGuestClientId(BAD_LAN_ID), null);
      const id = ensureGuestClientId(REST, TABLE);
      assert.equal(parseGuestClientId(id), id);
      assert.equal(store[guestClientStorageKey(REST, TABLE)], id);
    } finally {
      if (originalWindow === undefined) {
        delete (globalThis as { window?: unknown }).window;
      } else {
        Object.defineProperty(globalThis, 'window', {
          configurable: true,
          value: originalWindow,
        });
      }
    }
  });
});
