import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  mergeByItemSplitResultWithLedger,
  mergeSplitResultWithLedger,
} from './bill-split-result-merge';

describe('mergeSplitResultWithLedger', () => {
  it('preserves existing order and updates amount by case-insensitive name', () => {
    const merged = mergeSplitResultWithLedger(
      [
        { name: 'Alice', amount: 30, paid: true },
        { name: 'Bob', amount: 25 },
      ],
      [
        { name: 'bob', amount: 40 },
        { name: 'ALICE', amount: 35 },
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

describe('mergeByItemSplitResultWithLedger', () => {
  it('updates Tom amount when incoming uses different casing', () => {
    const merged = mergeByItemSplitResultWithLedger(
      [
        { name: 'John', amount: 50, paid: true },
        { name: 'Tom', amount: 30 },
      ],
      [
        { name: 'John', amount: 61.7 },
        { name: 'tom', amount: 2.5 },
      ],
    );
    assert.equal(merged.length, 2);
    assert.equal(merged[0]?.name, 'John');
    assert.equal(merged[0]?.amount, 61.7);
    assert.equal(merged[0]?.paid, true);
    assert.equal(merged[1]?.name, 'Tom');
    assert.equal(merged[1]?.amount, 2.5);
  });

  it('drops stale rows when person no longer appears in incoming', () => {
    const merged = mergeByItemSplitResultWithLedger(
      [
        { name: 'John', amount: 40 },
        { name: 'Tom', amount: 30 },
      ],
      [
        { name: 'John', amount: 36.2 },
        { name: 'Jack', amount: 27.5 },
      ],
    );
    assert.equal(merged.length, 2);
    assert.equal(merged[0]?.name, 'John');
    assert.equal(merged[1]?.name, 'Jack');
    assert.equal(merged[1]?.amount, 27.5);
  });

  it('appends new payers after existing rows to preserve person_index', () => {
    const merged = mergeByItemSplitResultWithLedger(
      [{ name: 'John', amount: 40, paid: true }],
      [
        { name: 'John', amount: 50 },
        { name: 'Jack', amount: 14.2 },
      ],
    );
    assert.equal(merged.length, 2);
    assert.equal(merged[0]?.name, 'John');
    assert.equal(merged[1]?.name, 'Jack');
  });
});
