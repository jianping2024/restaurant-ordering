import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import {
  floorLaneKey,
  loadWaiterBoardSelectedLaneKey,
  parseWaiterBoardLaneKey,
  partyLaneKey,
  resolveWaiterBoardSelectedLaneKey,
  saveWaiterBoardSelectedLaneKey,
  waiterBoardSelectedLaneStorageKey,
} from './waiter-board-section-preference';

describe('waiterBoardSelectedLaneStorageKey', () => {
  it('scopes selected lane by restaurant', () => {
    assert.equal(
      waiterBoardSelectedLaneStorageKey('r1'),
      'mesa-waiter-board-lane:r1',
    );
  });
});

describe('lane key helpers', () => {
  it('encodes and parses floor and party keys', () => {
    assert.equal(floorLaneKey('g1'), 'floor:g1');
    assert.equal(partyLaneKey('p1'), 'party:p1');
    assert.deepEqual(parseWaiterBoardLaneKey('floor:__ungrouped__'), {
      kind: 'floor',
      id: '__ungrouped__',
    });
    assert.deepEqual(parseWaiterBoardLaneKey('party:abc'), { kind: 'party', id: 'abc' });
    assert.equal(parseWaiterBoardLaneKey('nope'), null);
    assert.equal(parseWaiterBoardLaneKey('floor:'), null);
  });

  it('resolves preferred lane or falls back floor then party', () => {
    const floors = [floorLaneKey('a'), floorLaneKey('b')];
    const parties = [partyLaneKey('p1')];
    assert.equal(
      resolveWaiterBoardSelectedLaneKey(floorLaneKey('b'), floors, parties),
      floorLaneKey('b'),
    );
    assert.equal(
      resolveWaiterBoardSelectedLaneKey(partyLaneKey('p1'), floors, parties),
      partyLaneKey('p1'),
    );
    assert.equal(
      resolveWaiterBoardSelectedLaneKey(floorLaneKey('gone'), floors, parties),
      floorLaneKey('a'),
    );
    assert.equal(
      resolveWaiterBoardSelectedLaneKey(floorLaneKey('gone'), [], parties),
      partyLaneKey('p1'),
    );
    assert.equal(resolveWaiterBoardSelectedLaneKey(null, [], []), null);
  });
});

describe('waiter board selected lane preference', () => {
  const key = waiterBoardSelectedLaneStorageKey('test-restaurant');
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

  it('round-trips selected lane key', () => {
    assert.equal(loadWaiterBoardSelectedLaneKey('test-restaurant'), null);
    saveWaiterBoardSelectedLaneKey('test-restaurant', floorLaneKey('g1'));
    assert.equal(loadWaiterBoardSelectedLaneKey('test-restaurant'), floorLaneKey('g1'));
    assert.equal(storage.get(key), 'floor:g1');
  });

  it('clears stored lane when null', () => {
    saveWaiterBoardSelectedLaneKey('test-restaurant', partyLaneKey('p1'));
    saveWaiterBoardSelectedLaneKey('test-restaurant', null);
    assert.equal(loadWaiterBoardSelectedLaneKey('test-restaurant'), null);
    assert.equal(storage.has(key), false);
  });

  it('returns null for invalid stored value', () => {
    storage.set(key, 'not-a-lane');
    assert.equal(loadWaiterBoardSelectedLaneKey('test-restaurant'), null);
  });
});
