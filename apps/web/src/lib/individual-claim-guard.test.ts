import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { claimBreakLineKeys } from './individual-claim-guard';
import type { ByItemLineSpec } from './bill-split-by-item-lines';
import type { SplitPerson } from '../types';

const PA = '11111111-1111-4111-8111-111111111111';
const PB = '22222222-2222-4222-8222-222222222222';

function spec(key: string, qty: number, price: number): ByItemLineSpec {
  return { mode: 'menu', key, lineQty: qty, lineTotal: qty * price, unitPrice: price };
}

function person(name: string, partyId: string, shares: Array<[string, number]>): SplitPerson {
  return {
    name,
    party_id: partyId,
    item_shares: shares.map(([key, qty]) => ({ key, qty_num: qty, qty_den: 1, party_id: partyId })),
  };
}

describe('claimBreakLineKeys', () => {
  const persons = [person('Wang', PA, [['L2', 2]]), person('Li', PB, [['L3', 1]])];

  it('is empty while the lines still cover every holding ticket', () => {
    assert.deepEqual(
      claimBreakLineKeys({
        lineSpecs: [spec('L2', 2, 8), spec('L3', 4, 3)],
        persons,
        holdingKeys: new Set([`p:${PA}`, `p:${PB}`]),
      }),
      [],
    );
  });

  it('flags a line reduced below what called tickets claim', () => {
    assert.deepEqual(
      claimBreakLineKeys({
        lineSpecs: [spec('L2', 1, 8), spec('L3', 4, 3)],
        persons,
        holdingKeys: new Set([`p:${PA}`]),
      }),
      ['L2'],
    );
  });

  it('flags a claimed line that was voided away entirely', () => {
    assert.deepEqual(
      claimBreakLineKeys({
        lineSpecs: [spec('L3', 4, 3)],
        persons,
        holdingKeys: new Set([`p:${PA}`]),
      }),
      ['L2'],
    );
  });

  it('ignores tickets that do not hold a claim (draft / unlocked)', () => {
    assert.deepEqual(
      claimBreakLineKeys({
        lineSpecs: [spec('L2', 1, 8)],
        persons,
        holdingKeys: new Set([`p:${PB}`]),
      }),
      ['L3'],
    );
    assert.deepEqual(
      claimBreakLineKeys({
        lineSpecs: [spec('L2', 1, 8)],
        persons,
        holdingKeys: new Set(),
      }),
      [],
    );
  });
});
