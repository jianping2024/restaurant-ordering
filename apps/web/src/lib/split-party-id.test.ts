import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { allocateByItemShareAmounts } from './bill-split-by-item';
import { mintSplitPartyId, splitPartyKey } from './split-party-id';

describe('splitPartyKey', () => {
  it('prefers party_id over name', () => {
    assert.equal(splitPartyKey('aaa', '客人 3'), 'p:aaa');
    assert.equal(splitPartyKey(undefined, '客人 3'), 'n:客人 3');
  });

  it('mints unique ticket ids', () => {
    assert.notEqual(mintSplitPartyId(), mintSplitPartyId());
  });
});

describe('allocateByItemShareAmounts paid freeze', () => {
  it('keeps frozen share amount when open peer qty changes', () => {
    const line = {
      mode: 'menu' as const,
      key: 'sumol',
      name: 'Sumol',
      unitPrice: 2.2,
      qty: 4,
    };
    const withHalf = allocateByItemShareAmounts(line, [
      { name: '客人 3', qty: { num: 1, den: 3 }, frozenAmount: 0.74 },
      { name: '客人 4', qty: { num: 2, den: 3 } },
    ]);
    assert.equal(withHalf[0], 0.74);
    const withExtra = allocateByItemShareAmounts(line, [
      { name: '客人 3', qty: { num: 1, den: 3 }, frozenAmount: 0.74 },
      { name: '客人 4', qty: { num: 2, den: 3 } },
      { name: '客人 8', qty: { num: 1, den: 2 } },
    ]);
    assert.equal(withExtra[0], 0.74);
    assert.ok((withExtra[1] ?? 0) + (withExtra[2] ?? 0) > 0);
  });
});
