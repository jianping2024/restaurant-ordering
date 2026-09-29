import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sushiFreeItemDisplayQty } from './client-api';

describe('sushiFreeItemDisplayQty', () => {
  it('uses cart qty when the dish is in the local cart', () => {
    assert.equal(
      sushiFreeItemDisplayQty({ cartHasItem: true, cartQty: 2, ownRoundQty: 5 }),
      2,
    );
  });

  it('falls back to own round qty when cart has no entry', () => {
    assert.equal(
      sushiFreeItemDisplayQty({ cartHasItem: false, cartQty: 0, ownRoundQty: 5 }),
      5,
    );
  });

  it('returns 0 when both empty', () => {
    assert.equal(
      sushiFreeItemDisplayQty({ cartHasItem: false, cartQty: undefined, ownRoundQty: 0 }),
      0,
    );
  });
});
