import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mergeByItemSplitResultWithLedger } from './bill-split-result-merge';

describe('mergeByItemSplitResultWithLedger', () => {
  it('keeps paid ticket amount; updates unpaid only', () => {
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
    assert.equal(merged[0]?.amount, 50);
    assert.equal(merged[0]?.paid, true);
    assert.equal(merged[1]?.name, 'Tom');
    assert.equal(merged[1]?.amount, 2.5);
  });

  it('drops stale unpaid rows when person no longer appears in incoming', () => {
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

  it('keeps paid ticket when incoming omits it', () => {
    const paidId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const unpaidId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    const merged = mergeByItemSplitResultWithLedger(
      [
        { name: 'John', amount: 40, paid: true, party_id: paidId },
        { name: 'Tom', amount: 30, party_id: unpaidId },
      ],
      [{ name: 'Jack', amount: 27.5, party_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc' }],
    );
    assert.equal(merged.length, 2);
    assert.equal(merged[0]?.party_id, paidId);
    assert.equal(merged[0]?.paid, true);
    assert.equal(merged[0]?.amount, 40);
    assert.equal(merged[1]?.name, 'Jack');
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
    assert.equal(merged[0]?.amount, 40);
    assert.equal(merged[1]?.name, 'Jack');
  });

  it('keeps two same-name tickets when party_id differs', () => {
    const paidId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const unpaidId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    const merged = mergeByItemSplitResultWithLedger(
      [{ name: '客人1', amount: 19.95, paid: true, party_id: paidId }],
      [
        { name: '客人1', amount: 20.01, party_id: paidId },
        { name: '客人1', amount: 2.2, party_id: unpaidId },
      ],
    );
    assert.equal(merged.length, 2);
    assert.equal(merged[0]?.party_id, paidId);
    assert.equal(merged[0]?.paid, true);
    assert.equal(merged[0]?.amount, 19.95);
    assert.equal(merged[1]?.party_id, unpaidId);
    assert.equal(merged[1]?.amount, 2.2);
  });
});
