import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  compareRationalSumToTarget,
  formatRational,
  parseQtyInput,
  rationalFromInt,
  sumRationals,
} from './rational-qty';

describe('parseQtyInput', () => {
  it('parses integers, fractions, and mixed numbers', () => {
    assert.deepEqual(parseQtyInput('2'), rationalFromInt(2));
    assert.deepEqual(parseQtyInput('1/3'), { num: 1, den: 3 });
    assert.deepEqual(parseQtyInput('2 1/3'), { num: 7, den: 3 });
  });
});

describe('formatRational', () => {
  it('formats mixed numbers readably', () => {
    assert.equal(formatRational({ num: 7, den: 3 }), '2 1/3');
    assert.equal(formatRational({ num: 1, den: 3 }), '1/3');
    assert.equal(formatRational({ num: 2, den: 1 }), '2');
  });
});

describe('compareRationalSumToTarget', () => {
  it('detects complete allocation for five bottles split three ways', () => {
    const shares = [parseQtyInput('2 1/3'), parseQtyInput('1 1/3'), parseQtyInput('1 1/3')].filter(Boolean);
    assert.equal(compareRationalSumToTarget(shares, 5), 0);
    assert.equal(formatRational(sumRationals(shares)), '5');
  });
});
