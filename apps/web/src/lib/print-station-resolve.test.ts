import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  normalizePrintStationIds,
  orderItemMatchesPrintStation,
  resolveEffectivePrintStationIds,
} from './print-station-resolve';

describe('normalizePrintStationIds', () => {
  it('drops empties and duplicates, keeps first-seen order', () => {
    assert.deepEqual(normalizePrintStationIds(['b', '', 'a', 'b', null, '  c  ']), [
      'b',
      'a',
      'c',
    ]);
  });
});

describe('resolveEffectivePrintStationIds', () => {
  const categories = [
    { id: 'root', parent_id: null, print_station_id: 'st-root' },
    { id: 'child', parent_id: 'root', print_station_id: null },
    { id: 'leaf', parent_id: 'child', print_station_id: null },
  ];

  it('uses item list when non-empty (override)', () => {
    assert.deepEqual(
      resolveEffectivePrintStationIds(['st-a', 'st-b'], 'leaf', categories),
      ['st-a', 'st-b'],
    );
  });

  it('inherits category walk when item list empty', () => {
    assert.deepEqual(resolveEffectivePrintStationIds([], 'leaf', categories), ['st-root']);
    assert.deepEqual(resolveEffectivePrintStationIds(null, 'leaf', categories), ['st-root']);
  });

  it('returns empty when neither item nor category binds', () => {
    assert.deepEqual(
      resolveEffectivePrintStationIds(
        [],
        'orphan',
        [{ id: 'orphan', parent_id: null, print_station_id: null }],
      ),
      [],
    );
  });
});

describe('orderItemMatchesPrintStation', () => {
  it('matches any id in print_station_ids', () => {
    assert.equal(
      orderItemMatchesPrintStation({ print_station_ids: ['a', 'b'] }, 'b'),
      true,
    );
    assert.equal(
      orderItemMatchesPrintStation({ print_station_ids: ['a', 'b'] }, 'c'),
      false,
    );
  });

  it('falls back to legacy single print_station_id', () => {
    assert.equal(orderItemMatchesPrintStation({ print_station_id: 'a' }, 'a'), true);
    assert.equal(orderItemMatchesPrintStation({ print_station_id: 'a' }, 'b'), false);
  });
});
