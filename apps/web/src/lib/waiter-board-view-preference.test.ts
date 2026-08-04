import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import {
  DEFAULT_WAITER_BOARD_VIEW_PREFERENCE,
  floorLaneKey,
  loadWaiterBoardViewPreference,
  parseWaiterBoardFilter,
  parseWaiterBoardLaneKey,
  parseWaiterBoardViewPreference,
  partyLaneKey,
  resolveWaiterBoardSelectedLaneKey,
  saveWaiterBoardViewPreference,
  waiterBoardViewPreferenceStorageKey,
} from './waiter-board-view-preference';

describe('waiterBoardViewPreferenceStorageKey', () => {
  it('scopes view preference by restaurant', () => {
    assert.equal(
      waiterBoardViewPreferenceStorageKey('r1'),
      'mesa-waiter-board-view:r1',
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
    assert.deepEqual(parseWaiterBoardLaneKey('party:abc'), {
      kind: 'party',
      id: 'abc',
    });
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

describe('parseWaiterBoardFilter', () => {
  it('accepts known filters and falls back to all', () => {
    assert.equal(parseWaiterBoardFilter('dining'), 'dining');
    assert.equal(parseWaiterBoardFilter('idle'), 'idle');
    assert.equal(parseWaiterBoardFilter('checkout'), 'checkout');
    assert.equal(parseWaiterBoardFilter('all'), 'all');
    assert.equal(parseWaiterBoardFilter('nope'), 'all');
    assert.equal(parseWaiterBoardFilter(1), 'all');
    assert.equal(parseWaiterBoardFilter(null), 'all');
  });
});

describe('parseWaiterBoardViewPreference', () => {
  it('parses JSON object shape', () => {
    assert.deepEqual(
      parseWaiterBoardViewPreference({
        laneKey: 'floor:g1',
        filter: 'dining',
        search: '001',
      }),
      { laneKey: 'floor:g1', filter: 'dining', search: '001' },
    );
  });

  it('migrates legacy plain lane string', () => {
    assert.deepEqual(parseWaiterBoardViewPreference('floor:g1'), {
      ...DEFAULT_WAITER_BOARD_VIEW_PREFERENCE,
      laneKey: 'floor:g1',
    });
  });

  it('rejects invalid filter and lane', () => {
    assert.deepEqual(
      parseWaiterBoardViewPreference({
        laneKey: 'bad',
        filter: 'xyz',
        search: 9,
      }),
      DEFAULT_WAITER_BOARD_VIEW_PREFERENCE,
    );
  });
});

describe('waiter board view preference storage', () => {
  const restaurantId = 'test-restaurant';
  const viewKey = waiterBoardViewPreferenceStorageKey(restaurantId);
  const legacyKey = `mesa-waiter-board-lane:${restaurantId}`;
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

  it('round-trips filter, search, and lane as one JSON blob', () => {
    assert.deepEqual(
      loadWaiterBoardViewPreference(restaurantId),
      DEFAULT_WAITER_BOARD_VIEW_PREFERENCE,
    );
    saveWaiterBoardViewPreference(restaurantId, {
      laneKey: floorLaneKey('g1'),
      filter: 'dining',
      search: '12',
    });
    assert.deepEqual(loadWaiterBoardViewPreference(restaurantId), {
      laneKey: floorLaneKey('g1'),
      filter: 'dining',
      search: '12',
    });
    assert.equal(storage.has(legacyKey), false);
    assert.equal(JSON.parse(storage.get(viewKey)!).filter, 'dining');
  });

  it('clears storage when preference is default', () => {
    saveWaiterBoardViewPreference(restaurantId, {
      laneKey: partyLaneKey('p1'),
      filter: 'idle',
      search: 'x',
    });
    saveWaiterBoardViewPreference(restaurantId, {
      ...DEFAULT_WAITER_BOARD_VIEW_PREFERENCE,
    });
    assert.equal(storage.has(viewKey), false);
    assert.deepEqual(
      loadWaiterBoardViewPreference(restaurantId),
      DEFAULT_WAITER_BOARD_VIEW_PREFERENCE,
    );
  });

  it('migrates legacy lane-only string and drops legacy key on save', () => {
    storage.set(legacyKey, floorLaneKey('legacy'));
    assert.deepEqual(loadWaiterBoardViewPreference(restaurantId), {
      ...DEFAULT_WAITER_BOARD_VIEW_PREFERENCE,
      laneKey: floorLaneKey('legacy'),
    });
    saveWaiterBoardViewPreference(restaurantId, {
      laneKey: floorLaneKey('legacy'),
      filter: 'idle',
      search: '',
    });
    assert.equal(storage.has(legacyKey), false);
    assert.deepEqual(loadWaiterBoardViewPreference(restaurantId), {
      laneKey: floorLaneKey('legacy'),
      filter: 'idle',
      search: '',
    });
  });

  it('returns defaults for invalid stored JSON', () => {
    storage.set(viewKey, '{"laneKey":"not-a-lane","filter":"nope"}');
    assert.deepEqual(
      loadWaiterBoardViewPreference(restaurantId),
      DEFAULT_WAITER_BOARD_VIEW_PREFERENCE,
    );
  });
});
