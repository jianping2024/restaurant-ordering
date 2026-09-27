import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyCustomAmountEdit,
  seedCustomSoloFullAmount,
} from './bill-split-custom-amounts';

describe('seedCustomSoloFullAmount', () => {
  it('sets the sole row to the bill total', () => {
    assert.deepEqual(seedCustomSoloFullAmount([{ name: 'Guest 1', amount: 0 }], 19.95), [
      { name: 'Guest 1', amount: 19.95 },
    ]);
  });

  it('leaves multi-person rows unchanged', () => {
    const rows = [
      { name: 'A', amount: 10 },
      { name: 'B', amount: 9.95 },
    ];
    assert.deepEqual(seedCustomSoloFullAmount(rows, 19.95), rows);
  });
});

describe('applyCustomAmountEdit', () => {
  it('auto-appends a remainder person when the sole share is below total', () => {
    const next = applyCustomAmountEdit({
      rows: [{ name: 'Guest 1', amount: 19.95 }],
      index: 0,
      rawValue: '10',
      total: 19.95,
      nextGuestName: 'Guest 2',
    });
    assert.deepEqual(next, [
      { name: 'Guest 1', amount: 10 },
      { name: 'Guest 2', amount: 9.95 },
    ]);
  });

  it('keeps a single row when the sole share equals total', () => {
    const next = applyCustomAmountEdit({
      rows: [{ name: 'Guest 1', amount: 19.95 }],
      index: 0,
      rawValue: '19.95',
      total: 19.95,
      nextGuestName: 'Guest 2',
    });
    assert.deepEqual(next, [{ name: 'Guest 1', amount: 19.95 }]);
  });

  it('does not collapse two rows when the first share returns to full', () => {
    const next = applyCustomAmountEdit({
      rows: [
        { name: 'Guest 1', amount: 10 },
        { name: 'Guest 2', amount: 9.95 },
      ],
      index: 0,
      rawValue: '19.95',
      total: 19.95,
      nextGuestName: 'Guest 3',
    });
    assert.deepEqual(next, [
      { name: 'Guest 1', amount: 19.95 },
      { name: 'Guest 2', amount: 0 },
    ]);
  });

  it('clamps a manual share so the bill cannot be exceeded', () => {
    const next = applyCustomAmountEdit({
      rows: [
        { name: 'Guest 1', amount: 5 },
        { name: 'Guest 2', amount: 5 },
        { name: 'Guest 3', amount: 9.95 },
      ],
      index: 0,
      rawValue: '100',
      total: 19.95,
      nextGuestName: 'Guest 4',
    });
    assert.equal(next[0]?.amount, 14.95);
    assert.equal(next[1]?.amount, 5);
    assert.equal(next[2]?.amount, 0);
  });

  it('ignores edits on the remainder row', () => {
    const rows = [
      { name: 'Guest 1', amount: 10 },
      { name: 'Guest 2', amount: 9.95 },
    ];
    const next = applyCustomAmountEdit({
      rows,
      index: 1,
      rawValue: '1',
      total: 19.95,
      nextGuestName: 'Guest 3',
    });
    assert.deepEqual(next, rows);
  });
});
