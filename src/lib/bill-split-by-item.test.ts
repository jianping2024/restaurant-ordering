import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { byItemAssigneesForKey, byItemQtyShareLabel } from './bill-split-by-item';

describe('byItemQtyShareLabel', () => {
  it('shows 1/3 when one item is shared by three people', () => {
    assert.equal(byItemQtyShareLabel(1, 3), '1/3');
  });

  it('shows full qty when one person owns the line', () => {
    assert.equal(byItemQtyShareLabel(1, 1), '1');
    assert.equal(byItemQtyShareLabel(2, 1), '2');
  });

  it('simplifies fractions', () => {
    assert.equal(byItemQtyShareLabel(2, 4), '1/2');
    assert.equal(byItemQtyShareLabel(6, 3), '2');
  });
});

describe('byItemAssigneesForKey', () => {
  it('lists person ids assigned to a line key', () => {
    const persons = [
      { items: ['order-0'] },
      { items: ['order-0', 'order-1'] },
      { items: ['order-0'] },
    ];
    assert.deepEqual(byItemAssigneesForKey(persons, 'order-0'), ['p1', 'p2', 'p3']);
    assert.deepEqual(byItemAssigneesForKey(persons, 'order-1'), ['p2']);
  });
});