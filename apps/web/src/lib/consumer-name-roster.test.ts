import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ByItemConsumerRow } from '@/lib/bill-split-by-item';
import {
  addToConsumerRoster,
  filterConsumerNameOptions,
  namesUsedOnOtherDishRows,
  rememberConsumerName,
  suggestConsumerNamesForRow,
} from '@/lib/consumer-name-roster';

const row = (id: string, name: string): ByItemConsumerRow => ({
  id,
  name,
  qtyInput: '',
});

describe('addToConsumerRoster', () => {
  it('dedupes case-insensitively', () => {
    assert.deepEqual(addToConsumerRoster(['John'], 'john'), ['John']);
  });
});

describe('rememberConsumerName', () => {
  it('keeps roster when blur commits a single character', () => {
    assert.deepEqual(rememberConsumerName(['John'], 'J', false), ['John']);
  });

  it('adds on blur when name has at least two characters', () => {
    assert.deepEqual(rememberConsumerName([], 'John', false), ['John']);
  });

  it('does not add partial prefixes of roster names on blur', () => {
    assert.deepEqual(rememberConsumerName(['John'], 'Jo', false), ['John']);
    assert.deepEqual(rememberConsumerName(['John'], 'Joh', false), ['John']);
  });

  it('adds on list pick even for short names', () => {
    assert.deepEqual(rememberConsumerName([], 'Li', true), ['Li']);
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
