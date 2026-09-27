import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  afterRemoveCustomPerson,
  appendCustomPersonWithRemainder,
  applyCustomAmountEdit,
  mintNextCustomGuestName,
  rebalanceCustomRowsToBill,
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

describe('rebalanceCustomRowsToBill', () => {
  it('makes the last row absorb the remainder', () => {
    assert.deepEqual(
      rebalanceCustomRowsToBill(
        [
          { name: 'Guest 1', amount: 10 },
          { name: 'Guest 2', amount: 5 },
          { name: 'Guest 3', amount: 0 },
        ],
        19.95,
      ),
      [
        { name: 'Guest 1', amount: 10 },
        { name: 'Guest 2', amount: 5 },
        { name: 'Guest 3', amount: 4.95 },
      ],
    );
  });

  it('seeds a sole row to the full bill', () => {
    assert.deepEqual(
      rebalanceCustomRowsToBill([{ name: 'Guest 1', amount: 0 }], 39.9),
      [{ name: 'Guest 1', amount: 39.9 }],
    );
  });
});

describe('mintNextCustomGuestName', () => {
  it('skips labels already on the roster', () => {
    assert.equal(
      mintNextCustomGuestName([{ name: 'Guest 2' }], (n) => `Guest ${n}`),
      'Guest 1',
    );
  });
});

describe('applyCustomAmountEdit', () => {
  it('does not append a second person when the sole share is below total', () => {
    const next = applyCustomAmountEdit({
      rows: [{ name: 'Guest 1', amount: 19.95 }],
      index: 0,
      rawValue: '10',
      total: 19.95,
    });
    assert.deepEqual(next, [{ name: 'Guest 1', amount: 10 }]);
  });

  it('keeps a single row when the sole share equals total', () => {
    const next = applyCustomAmountEdit({
      rows: [{ name: 'Guest 1', amount: 19.95 }],
      index: 0,
      rawValue: '19.95',
      total: 19.95,
    });
    assert.deepEqual(next, [{ name: 'Guest 1', amount: 19.95 }]);
  });

  it('edits the second of two and absorbs into the first', () => {
    const next = applyCustomAmountEdit({
      rows: [
        { name: 'Guest 1', amount: 10 },
        { name: 'Guest 2', amount: 9.95 },
      ],
      index: 1,
      rawValue: '5',
      total: 19.95,
    });
    assert.deepEqual(next, [
      { name: 'Guest 1', amount: 14.95 },
      { name: 'Guest 2', amount: 5 },
    ]);
  });

  it('edits the first of two and absorbs into the second', () => {
    const next = applyCustomAmountEdit({
      rows: [
        { name: 'Guest 1', amount: 10 },
        { name: 'Guest 2', amount: 9.95 },
      ],
      index: 0,
      rawValue: '19.95',
      total: 19.95,
    });
    assert.deepEqual(next, [
      { name: 'Guest 1', amount: 19.95 },
      { name: 'Guest 2', amount: 0 },
    ]);
  });

  it('clamps a middle share so the bill cannot be exceeded', () => {
    const next = applyCustomAmountEdit({
      rows: [
        { name: 'Guest 1', amount: 5 },
        { name: 'Guest 2', amount: 5 },
        { name: 'Guest 3', amount: 9.95 },
      ],
      index: 0,
      rawValue: '100',
      total: 19.95,
    });
    assert.equal(next[0]?.amount, 14.95);
    assert.equal(next[1]?.amount, 5);
    assert.equal(next[2]?.amount, 0);
  });

  it('edits the last of three and absorbs into the second-last', () => {
    const next = applyCustomAmountEdit({
      rows: [
        { name: 'Guest 1', amount: 5 },
        { name: 'Guest 2', amount: 5 },
        { name: 'Guest 3', amount: 9.95 },
      ],
      index: 2,
      rawValue: '2',
      total: 19.95,
    });
    assert.deepEqual(next, [
      { name: 'Guest 1', amount: 5 },
      { name: 'Guest 2', amount: 12.95 },
      { name: 'Guest 3', amount: 2 },
    ]);
  });
});

describe('appendCustomPersonWithRemainder', () => {
  it('appends a person with the unpaid remainder', () => {
    assert.deepEqual(
      appendCustomPersonWithRemainder([{ name: 'Guest 1', amount: 10 }], 19.95, 'Guest 2'),
      [
        { name: 'Guest 1', amount: 10 },
        { name: 'Guest 2', amount: 9.95 },
      ],
    );
  });

  it('appends €0 when the roster already covers the bill', () => {
    assert.deepEqual(
      appendCustomPersonWithRemainder([{ name: 'Guest 1', amount: 19.95 }], 19.95, 'Guest 2'),
      [
        { name: 'Guest 1', amount: 19.95 },
        { name: 'Guest 2', amount: 0 },
      ],
    );
  });
});

describe('afterRemoveCustomPerson', () => {
  it('seeds the sole remaining person to the full bill', () => {
    assert.deepEqual(
      afterRemoveCustomPerson([{ name: 'Guest 1', amount: 10 }], 19.95),
      [{ name: 'Guest 1', amount: 19.95 }],
    );
  });

  it('rebalances the last row when two or more remain', () => {
    assert.deepEqual(
      afterRemoveCustomPerson(
        [
          { name: 'Guest 1', amount: 10 },
          { name: 'Guest 3', amount: 4.95 },
        ],
        19.95,
      ),
      [
        { name: 'Guest 1', amount: 10 },
        { name: 'Guest 3', amount: 9.95 },
      ],
    );
  });
});
