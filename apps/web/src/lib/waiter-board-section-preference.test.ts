import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import {
  loadWaiterBoardCollapsedSectionIds,
  saveWaiterBoardCollapsedSectionIds,
  waiterBoardCollapsedStorageKey,
} from './waiter-board-section-preference';

describe('waiterBoardCollapsedStorageKey', () => {
  it('scopes collapsed sections by restaurant', () => {
    assert.equal(
      waiterBoardCollapsedStorageKey('r1'),
      'mesa-waiter-board-collapsed:r1',
    );
  });
});

describe('waiter board collapsed section preference', () => {
  const key = waiterBoardCollapsedStorageKey('test-restaurant');
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

  it('round-trips collapsed section ids', () => {
    assert.equal(loadWaiterBoardCollapsedSectionIds('test-restaurant'), null);
    saveWaiterBoardCollapsedSectionIds('test-restaurant', new Set(['g1', 'g2']));
    assert.deepEqual(loadWaiterBoardCollapsedSectionIds('test-restaurant'), new Set(['g1', 'g2']));
    assert.equal(storage.get(key), JSON.stringify(['g1', 'g2']));
  });

  it('returns null for invalid stored json', () => {
    storage.set(key, 'not-json');
    assert.equal(loadWaiterBoardCollapsedSectionIds('test-restaurant'), null);
  });
});
