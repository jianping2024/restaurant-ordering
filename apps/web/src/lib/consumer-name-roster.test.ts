import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ByItemConsumerRow } from '@/lib/bill-split-by-item';
import {
  addToConsumerRoster,
  collectActiveConsumerNames,
  filterConsumerNameOptions,
  namesUsedOnOtherDishRows,
  suggestConsumerNamesForRow,
} from '@/lib/consumer-name-roster';

const row = (id: string, name: string): ByItemConsumerRow => ({
  id,
  name,
  qtyWhole: '',
  qtyNum: '',
  qtyDen: '',
});

describe('addToConsumerRoster', () => {
  it('dedupes case-insensitively', () => {
    assert.deepEqual(addToConsumerRoster(['John'], 'john'), ['John']);
  });
});

describe('collectActiveConsumerNames', () => {
  it('collects unique names from all dish rows with at least two characters', () => {
    assert.deepEqual(
      collectActiveConsumerNames({
        buffet: [row('b1', 'John'), row('b2', 'Johney')],
        drink: [row('d1', 'J'), row('d2', '')],
      }),
      ['John', 'Johney'],
    );
  });

  it('drops a name when its row is removed from allocations', () => {
    assert.deepEqual(
      collectActiveConsumerNames({
        buffet: [row('b1', 'John')],
      }),
      ['John'],
    );
  });

  it('does not include blur-only roster junk that never appears on a row', () => {
    const roster = collectActiveConsumerNames({
      buffet: [row('b1', 'John'), row('b2', 'Johney')],
      drink: [row('d1', '')],
    });
    assert.equal(roster.includes("J'o'h'n'e'y"), false);
    assert.equal(roster.includes('Johne'), false);
  });
});

describe('suggestConsumerNamesForRow', () => {
  const dishRows = [row('r1', 'John'), row('r2', '')];

  it('excludes names already used on other rows of the same dish', () => {
    assert.deepEqual(
      suggestConsumerNamesForRow({
        roster: ['John', 'Jerry'],
        dishRows,
        rowId: 'r2',
        query: 'J',
      }),
      ['Jerry'],
    );
  });

  it('still suggests a name on the same row while editing partial input', () => {
    assert.deepEqual(
      suggestConsumerNamesForRow({
        roster: ['John'],
        dishRows: [row('r1', 'J')],
        rowId: 'r1',
        query: 'J',
      }),
      ['John'],
    );
  });

  it('only suggests names present in the active session pool', () => {
    assert.deepEqual(
      suggestConsumerNamesForRow({
        roster: collectActiveConsumerNames({
          buffet: [row('b1', 'John'), row('b2', 'Johney')],
          drink: [row('d1', '')],
        }),
        dishRows: [row('d1', '')],
        rowId: 'd1',
        query: 'J',
      }),
      ['John', 'Johney'],
    );
  });

  it('matches after deleting characters from a longer partial input', () => {
    assert.deepEqual(filterConsumerNameOptions(['John'], 'Je'), []);
    assert.deepEqual(filterConsumerNameOptions(['John'], 'J'), ['John']);
    assert.deepEqual(
      suggestConsumerNamesForRow({
        roster: ['John'],
        dishRows: [row('r1', 'J')],
        rowId: 'r1',
        query: 'J',
      }),
      ['John'],
    );
  });
});

describe('namesUsedOnOtherDishRows', () => {
  it('is case-insensitive', () => {
    const used = namesUsedOnOtherDishRows([row('r1', 'john')], 'r2');
    assert.equal(used.has('john'), true);
  });
});
