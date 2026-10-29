import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  countCheckoutSupplyChargeLines,
  type CheckoutDisplayLine,
} from './checkout-session-lines';

function line(partial: Partial<CheckoutDisplayLine> & { key: string }): CheckoutDisplayLine {
  return {
    label: partial.label ?? 'x',
    quantityLabel: partial.quantityLabel ?? '×1',
    lineTotal: partial.lineTotal ?? 1,
    ...partial,
  };
}

describe('countCheckoutSupplyChargeLines', () => {
  it('counts only rows with chargeLineId', () => {
    assert.equal(
      countCheckoutSupplyChargeLines([
        line({ key: 'a' }),
        line({ key: 'b', chargeLineId: 'packaging:1' }),
        line({ key: 'c', chargeLineId: 'takeaway:2' }),
      ]),
      2,
    );
  });

  it('returns 0 for empty or dish-only lists', () => {
    assert.equal(countCheckoutSupplyChargeLines([]), 0);
    assert.equal(countCheckoutSupplyChargeLines([line({ key: 'dish' })]), 0);
  });
});
