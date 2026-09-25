import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calcByItemSplitResults } from './bill-split-by-item';

describe('calcByItemSplitResults personOrder', () => {
  it('emits roster order so 客人10 stays after 客人2', () => {
    const results = calcByItemSplitResults({
      lines: [
        { key: 'a', name: 'A', mode: 'menu', qty: 2, unitPrice: 2.2 },
      ],
      allocations: {
        a: [
          { name: '客人 10', qty: { num: 1, den: 1 } },
          { name: '客人 1', qty: { num: 1, den: 2 } },
          { name: '客人 2', qty: { num: 1, den: 2 } },
        ],
      },
      personOrder: ['客人 1', '客人 2', '客人 10'],
    });
    assert.deepEqual(
      results.map((row) => row.name),
      ['客人 1', '客人 2', '客人 10'],
    );
  });
});
