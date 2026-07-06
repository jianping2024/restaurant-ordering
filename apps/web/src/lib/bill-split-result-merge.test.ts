import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mergeSplitResultWithLedger } from './bill-split-result-merge';

describe('mergeSplitResultWithLedger', () => {
  it('preserves existing order and updates amount by name', () => {
    const merged = mergeSplitResultWithLedger(
      [
        { name: 'Alice', amount: 30, paid: true },
        { name: 'Bob', amount: 25 },
      ],
      [
        { name: 'Bob', amount: 40 },
        { name: 'Alice', amount: 35 },
      ],
    );
    assert.equal(merged[0]?.name, 'Alice');
    assert.equal(merged[0]?.amount, 35);
    assert.equal(merged[0]?.paid, true);
    assert.equal(merged[1]?.name, 'Bob');
    assert.equal(merged[1]?.amount, 40);
  });

  it('appends new names at end', () => {
    const merged = mergeSplitResultWithLedger(
      [
        { name: 'Alice', amount: 30 },
        { name: 'Carol', amount: 10 },
      ],
      [{ name: 'Alice', amount: 25, paid: true }],
    );
    assert.equal(merged.length, 2);
    assert.equal(merged[1]?.name, 'Carol');
  });
});
