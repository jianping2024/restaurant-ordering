import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  changedFractionLineKeys,
  fractionUnitConflict,
  fractionUnitConflictLineKeys,
  fractionUnitOfLine,
  parseOptionalUnitDen,
  unitDenForQty,
} from './by-item-fraction-unit';
import type { SplitPerson } from '../types';

const PA = '11111111-1111-4111-8111-111111111111';
const PB = '22222222-2222-4222-8222-222222222222';

const q = (num: number, den: number) => ({ num, den });

function person(
  name: string,
  partyId: string,
  shares: Array<[string, number, number, number?]>,
): SplitPerson {
  return {
    name,
    party_id: partyId,
    item_shares: shares.map(([key, qty_num, qty_den, qty_unit_den]) => ({
      key,
      qty_num,
      qty_den,
      party_id: partyId,
      ...(qty_unit_den ? { qty_unit_den } : {}),
    })),
  };
}

describe('parseOptionalUnitDen', () => {
  it('accepts only the 2..5 cuts', () => {
    assert.equal(parseOptionalUnitDen(2), 2);
    assert.equal(parseOptionalUnitDen(5), 5);
    assert.equal(parseOptionalUnitDen(1), undefined);
    assert.equal(parseOptionalUnitDen(6), undefined);
    assert.equal(parseOptionalUnitDen(2.5), undefined);
    assert.equal(parseOptionalUnitDen('3'), undefined);
    assert.equal(parseOptionalUnitDen(undefined), undefined);
  });
});

describe('unitDenForQty', () => {
  it('only fractional qty carries a unit', () => {
    assert.equal(unitDenForQty(q(2, 1), 3), undefined);
    assert.equal(unitDenForQty(q(1, 3), 3), 3);
    assert.equal(unitDenForQty(q(1, 2), 4), 4);
    assert.equal(unitDenForQty(q(1, 3), null), undefined);
  });
});

describe('fractionUnitOfLine', () => {
  it('is null while only whole portions are claimed (line stays free)', () => {
    assert.equal(fractionUnitOfLine([{ qty: q(2, 1) }]), null);
    assert.equal(fractionUnitOfLine([]), null);
  });

  it('prefers the stored unit over the denominator (2/4 reads as 1/2)', () => {
    assert.equal(fractionUnitOfLine([{ qty: q(1, 2), unitDen: 4 }]), 4);
  });

  it('infers from the denominator for shares without a stored unit', () => {
    assert.equal(fractionUnitOfLine([{ qty: q(1, 2) }]), 2);
    assert.equal(fractionUnitOfLine([{ qty: q(1, 2) }, { qty: q(1, 4) }]), 4);
  });
});

describe('fractionUnitConflict', () => {
  it('whole shares never conflict', () => {
    assert.equal(fractionUnitConflict([{ qty: q(1, 1) }, { qty: q(2, 1) }]), false);
  });

  it('same unit on every fractional share is fine', () => {
    assert.equal(
      fractionUnitConflict([
        { qty: q(1, 3), unitDen: 3 },
        { qty: q(2, 3), unitDen: 3 },
      ]),
      false,
    );
  });

  it('2/4 (unit 4) beside 1/4 (unit 4) is fine although the stored dens differ', () => {
    assert.equal(
      fractionUnitConflict([
        { qty: q(1, 2), unitDen: 4 },
        { qty: q(1, 4), unitDen: 4 },
      ]),
      false,
    );
  });

  it('1/2 cut in 2 beside 1/4 cut in 4 is a conflict (two cuts on one dish)', () => {
    assert.equal(
      fractionUnitConflict([
        { qty: q(1, 2), unitDen: 2 },
        { qty: q(1, 4), unitDen: 4 },
      ]),
      true,
    );
  });

  it('1/2 beside 1/3 is a conflict', () => {
    assert.equal(
      fractionUnitConflict([
        { qty: q(1, 2), unitDen: 2 },
        { qty: q(1, 3), unitDen: 3 },
      ]),
      true,
    );
  });

  it('a share without a unit must still fit the cut that is stored', () => {
    assert.equal(
      fractionUnitConflict([
        { qty: q(1, 4), unitDen: 4 },
        { qty: q(1, 2) },
      ]),
      false,
    );
    assert.equal(
      fractionUnitConflict([
        { qty: q(1, 3), unitDen: 3 },
        { qty: q(1, 2) },
      ]),
      true,
    );
  });

  it('legacy plans without units: 1/2 + 1/4 is tolerated, 1/2 + 1/3 is not', () => {
    assert.equal(fractionUnitConflict([{ qty: q(1, 2) }, { qty: q(1, 4) }]), false);
    assert.equal(fractionUnitConflict([{ qty: q(1, 2) }, { qty: q(1, 3) }]), true);
    assert.equal(fractionUnitConflict([{ qty: q(1, 7) }]), false);
    // 1/2 + 1/3 + 1/6 would nest in sixths, which the picker never offers.
    assert.equal(
      fractionUnitConflict([{ qty: q(1, 2) }, { qty: q(1, 3) }, { qty: q(1, 6) }]),
      true,
    );
  });
});

describe('fractionUnitConflictLineKeys', () => {
  it('reports only the conflicting lines', () => {
    const persons = [
      person('A', PA, [['L1', 1, 2, 2], ['L2', 1, 3, 3]]),
      person('B', PB, [['L1', 1, 3, 3], ['L2', 1, 3, 3]]),
    ];
    assert.deepEqual(fractionUnitConflictLineKeys(persons), ['L1']);
  });

  it('scope limits the check to lines this write touches (old mixed plan elsewhere is ignored)', () => {
    const persons = [
      person('A', PA, [['L1', 1, 2, 2], ['L2', 1, 2]]),
      person('B', PB, [['L1', 1, 3, 3], ['L2', 1, 4, 4]]),
    ];
    assert.deepEqual(fractionUnitConflictLineKeys(persons, new Set(['L2'])), []);
    assert.deepEqual(fractionUnitConflictLineKeys(persons, new Set(['L1'])), ['L1']);
  });
});

describe('changedFractionLineKeys', () => {
  it('lists lines whose fractional shares differ, and ignores whole-only changes', () => {
    const before = [
      person('A', PA, [['L1', 1, 2, 2], ['L2', 1, 3, 3], ['L3', 1, 1]]),
    ];
    const after = [
      person('A', PA, [['L1', 1, 2, 2], ['L2', 2, 3, 3], ['L3', 2, 1]]),
      person('B', PB, [['L4', 1, 4, 4]]),
    ];
    assert.deepEqual(Array.from(changedFractionLineKeys(before, after)).sort(), ['L2', 'L4']);
  });

  it('is empty for an identical plan', () => {
    const plan = [person('A', PA, [['L1', 1, 2, 2]])];
    assert.equal(changedFractionLineKeys(plan, plan).size, 0);
  });
});
