import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  allocateEvenAmounts,
  allocateProportionalCents,
  centsToEuros,
  eurosToCents,
} from './money-allocation';

describe('money-allocation', () => {
  it('allocateEvenAmounts splits €10 across 3 people', () => {
    const amounts = allocateEvenAmounts(10, ['C', 'A', 'B']);
    assert.equal(amounts.reduce((s, a) => s + a, 0), 10);
    assert.deepEqual(amounts.map((a) => eurosToCents(a)).sort((a, b) => a - b), [333, 333, 334]);
  });

  it('allocateProportionalCents preserves line total', () => {
    const names = ['tom', 'jerry', 'candy'];
    const weights = [667, 333, 333];
    const cents = allocateProportionalCents(1000, weights, (i) => names[i] ?? '');
    assert.equal(cents.reduce((s, c) => s + c, 0), 1000);
    assert.equal(centsToEuros(cents[0]!) + centsToEuros(cents[1]!) + centsToEuros(cents[2]!), 10);
  });
});
