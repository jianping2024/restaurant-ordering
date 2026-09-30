import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sushiFreeItemDisplayQty } from './client-api';

describe('sushiFreeItemDisplayQty', () => {
  it('uses cart qty when the dish is in the local cart', () => {
    assert.equal(sushiFreeItemDisplayQty({ cartHasItem: true, cartQty: 2 }), 2);
  });

  it('returns 0 when cart has no entry (does not show round qty)', () => {
    assert.equal(sushiFreeItemDisplayQty({ cartHasItem: false, cartQty: 0 }), 0);
    assert.equal(sushiFreeItemDisplayQty({ cartHasItem: false, cartQty: undefined }), 0);
  });

  it('returns 0 for non-positive cart qty', () => {
    assert.equal(sushiFreeItemDisplayQty({ cartHasItem: true, cartQty: 0 }), 0);
  });
});
