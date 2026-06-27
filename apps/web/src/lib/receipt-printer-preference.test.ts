import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import {
  loadSavedReceiptPrinterId,
  receiptPrinterStorageKey,
  saveReceiptPrinterId,
} from './receipt-printer-preference';

describe('receiptPrinterStorageKey', () => {
  it('scopes printer preference by restaurant slug', () => {
    assert.equal(receiptPrinterStorageKey('demo-bistro'), 'mesa-receipt-printer:demo-bistro');
  });
});

describe('receipt printer preference', () => {
  const slugA = 'restaurant-a';
  const slugB = 'restaurant-b';
  const keyA = receiptPrinterStorageKey(slugA);
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

  it('round-trips printer id per restaurant slug', () => {
    assert.equal(loadSavedReceiptPrinterId(slugA), '');
    saveReceiptPrinterId(slugA, 'station-cashier');
    assert.equal(loadSavedReceiptPrinterId(slugA), 'station-cashier');
    assert.equal(storage.get(keyA), 'station-cashier');
    assert.equal(loadSavedReceiptPrinterId(slugB), '');
  });

  it('clears storage when printer id is empty', () => {
    saveReceiptPrinterId(slugA, 'station-bar');
    saveReceiptPrinterId(slugA, '');
    assert.equal(loadSavedReceiptPrinterId(slugA), '');
    assert.equal(storage.has(keyA), false);
  });
});
