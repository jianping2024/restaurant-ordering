import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import {
  loadCheckoutSoundEnabled,
  saveCheckoutSoundEnabled,
} from './receipt-printer-preference';

describe('checkout sound preference', () => {
  const storage = new Map<string, string>();

  const originalWindow = globalThis.window;
  const originalLocalStorage = globalThis.localStorage;

  beforeEach(() => {
    storage.clear();
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {},
    });
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (k: string) => storage.get(k) ?? null,
        setItem: (k: string, v: string) => {
          storage.set(k, v);
        },
        removeItem: (k: string) => {
          storage.delete(k);
        },
      },
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: originalWindow,
    });
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: originalLocalStorage,
    });
  });

  it('defaults sound to enabled', () => {
    assert.equal(loadCheckoutSoundEnabled(), true);
  });

  it('persists sound preference', () => {
    saveCheckoutSoundEnabled(false);
    assert.equal(loadCheckoutSoundEnabled(), false);
    saveCheckoutSoundEnabled(true);
    assert.equal(loadCheckoutSoundEnabled(), true);
  });
});
