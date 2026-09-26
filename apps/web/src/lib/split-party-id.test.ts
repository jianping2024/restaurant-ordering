import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { allocateByItemShareAmounts } from './bill-split-by-item';
import { mintSplitPartyId, parseOptionalPartyId, parseOptionalPartyIdFromRow, splitPartyKey, toWireSplitResult } from './split-party-id';

describe('splitPartyKey', () => {
  it('prefers party_id over name', () => {
    assert.equal(splitPartyKey('aaa', '客人 3'), 'p:aaa');
    assert.equal(splitPartyKey(undefined, '客人 3'), 'n:客人 3');
  });

  it('mints unique ticket ids', () => {
    assert.notEqual(mintSplitPartyId(), mintSplitPartyId());
  });
});

describe('parseOptionalPartyId', () => {
  it('accepts trimmed uuid and rejects invalid', () => {
    const id = '5e960b2b-9913-483b-898e-3346cee52a32';
    assert.equal(parseOptionalPartyId(` ${id} `), id);
    assert.equal(parseOptionalPartyId(id.toUpperCase()), id.toUpperCase());
    assert.equal(parseOptionalPartyId(undefined), undefined);
    assert.equal(parseOptionalPartyId(''), undefined);
    assert.equal(parseOptionalPartyId('not-a-uuid'), undefined);
    assert.equal(parseOptionalPartyId(123), undefined);
  });

  it('reads party_id or partyId from a row', () => {
    const id = '5e960b2b-9913-483b-898e-3346cee52a32';
    assert.equal(parseOptionalPartyIdFromRow({ party_id: id }), id);
    assert.equal(parseOptionalPartyIdFromRow({ partyId: id }), id);
    assert.equal(parseOptionalPartyIdFromRow({ party_id: id, partyId: 'ignore' }), id);
    assert.equal(parseOptionalPartyIdFromRow({ partyId: 'bad' }), undefined);
  });
});

describe('toWireSplitResult', () => {
  it('emits snake_case party_id only', () => {
    const id = '5e960b2b-9913-483b-898e-3346cee52a32';
    const row = toWireSplitResult({
      name: '客人1',
      amount: 24,
      partyId: id,
      items: [{ name: 'Cola', qty: 1, price: 2.2 }],
    });
    assert.deepEqual(row, {
      name: '客人1',
      amount: 24,
      party_id: id,
      items: [{ name: 'Cola', qty: 1, price: 2.2 }],
    });
    assert.equal('partyId' in row, false);
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
