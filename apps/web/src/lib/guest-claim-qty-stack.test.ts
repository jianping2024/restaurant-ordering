import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  canStackGuestClaimUnit,
  canUnstackGuestClaimUnit,
  formatGuestClaimQtyLabel,
  guestClaimUnitPresets,
  lockedGuestClaimUnitDen,
  rationalFromGuestClaimRow,
  stackGuestClaimUnit,
  unstackGuestClaimUnit,
} from './guest-claim-qty-stack';

describe('lockedGuestClaimUnitDen', () => {
  it('stays open when others only hold wholes', () => {
    assert.equal(lockedGuestClaimUnitDen([{ num: 2, den: 1 }]), null);
  });

  it('locks to the fraction den others used', () => {
    assert.equal(lockedGuestClaimUnitDen([{ num: 1, den: 2 }]), 2);
  });

  it('uses LCM when others mixed dens', () => {
    assert.equal(
      lockedGuestClaimUnitDen([
        { num: 1, den: 2 },
        { num: 1, den: 3 },
      ]),
      6,
    );
  });
});

describe('guestClaimUnitPresets', () => {
  it('offers 1..5 when unlocked', () => {
    assert.deepEqual(guestClaimUnitPresets(null), [1, 2, 3, 4, 5]);
  });

  it('offers whole + locked den when locked', () => {
    assert.deepEqual(guestClaimUnitPresets(2), [1, 2]);
  });
});

describe('stack / unstack', () => {
  it('adds half units up to remaining', () => {
    const once = stackGuestClaimUnit({
      current: { num: 0, den: 1 },
      unitDen: 2,
      remaining: { num: 1, den: 1 },
    });
    assert.deepEqual(once, { qtyWhole: '', qtyNum: '1', qtyDen: '2' });
    const twice = stackGuestClaimUnit({
      current: rationalFromGuestClaimRow(once!),
      unitDen: 2,
      remaining: { num: 1, den: 1 },
    });
    assert.deepEqual(twice, { qtyWhole: '1', qtyNum: '', qtyDen: '' });
    assert.equal(
      canStackGuestClaimUnit({
        current: rationalFromGuestClaimRow(twice!),
        unitDen: 2,
        remaining: { num: 1, den: 1 },
      }),
      false,
    );
  });

  it('unstacks down to zero', () => {
    const mid = unstackGuestClaimUnit({
      current: { num: 1, den: 1 },
      unitDen: 2,
    });
    assert.deepEqual(mid, { qtyWhole: '', qtyNum: '1', qtyDen: '2' });
    const empty = unstackGuestClaimUnit({
      current: rationalFromGuestClaimRow(mid!),
      unitDen: 2,
    });
    assert.deepEqual(empty, { qtyWhole: '', qtyNum: '', qtyDen: '' });
    assert.equal(canUnstackGuestClaimUnit({ current: { num: 0, den: 1 }, unitDen: 2 }), false);
  });

  it('formats labels', () => {
    assert.equal(formatGuestClaimQtyLabel({ num: 0, den: 1 }), '0');
    assert.equal(formatGuestClaimQtyLabel({ num: 1, den: 2 }), '1/2');
  });
});
