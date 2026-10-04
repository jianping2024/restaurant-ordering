import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ByItemConsumerRow } from '@/lib/bill-split-by-item';
import {
  addToConsumerRoster,
  availableConsumerNamesForRow,
  collectActiveConsumerNames,
  filterConsumerNameOptions,
  namesUsedOnOtherDishRows,
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
  it('collects unique non-empty names from all dish rows, single characters included', () => {
    assert.deepEqual(
      collectActiveConsumerNames({
        buffet: [row('b1', 'John'), row('b2', 'Johney')],
        drink: [row('d1', 'J'), row('d2', '')],
      }),
      ['J', 'John', 'Johney'],
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

describe('availableConsumerNamesForRow', () => {
  const suggest = (params: Parameters<typeof availableConsumerNamesForRow>[0], query: string) =>
    filterConsumerNameOptions(availableConsumerNamesForRow(params), query);

  it('excludes names already used on other rows of the same dish', () => {
    assert.deepEqual(
      suggest({ roster: ['John', 'Jerry'], dishRows: [row('r1', 'John'), row('r2', '')], rowId: 'r2' }, 'J'),
      ['Jerry'],
    );
  });

  it('still suggests a name on the same row while editing partial input', () => {
    assert.deepEqual(
      suggest({ roster: ['John'], dishRows: [row('r1', 'J')], rowId: 'r1' }, 'J'),
      ['John'],
    );
  });

  it('only suggests names present in the active session pool', () => {
    assert.deepEqual(
      suggest(
        {
          roster: collectActiveConsumerNames({
            buffet: [row('b1', 'John'), row('b2', 'Johney')],
            drink: [row('d1', '')],
          }),
          dishRows: [row('d1', '')],
          rowId: 'd1',
        },
        'J',
      ),
      ['John', 'Johney'],
    );
  });
});

describe('availableConsumerNamesForRow with ticket ids', () => {
  it('still hides a name another unpaid row on the dish already uses, even with party ids', () => {
    const a = { ...row('r1', 'J'), partyId: 'a0000000-0000-4000-8000-000000000001' };
    const b = { ...row('r2', ''), partyId: 'a0000000-0000-4000-8000-000000000002' };
    assert.deepEqual(
      availableConsumerNamesForRow({ roster: ['J', 'W'], dishRows: [a, b], rowId: 'r2' }),
      ['W'],
    );
  });

  it('keeps offering a name whose other ticket on the dish is paid-locked', () => {
    const paid = { ...row('r1', 'J'), partyId: 'a0000000-0000-4000-8000-000000000001', paidLocked: true };
    assert.deepEqual(
      availableConsumerNamesForRow({
        roster: ['J', 'W'],
        dishRows: [paid, row('r2', '')],
        rowId: 'r2',
      }),
      ['J', 'W'],
    );
  });
});

describe('namesUsedOnOtherDishRows', () => {
  it('is case-insensitive', () => {
    const used = namesUsedOnOtherDishRows([row('r1', 'john')], 'r2');
    assert.equal(used.has('john'), true);
  });
});
