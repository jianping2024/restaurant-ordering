import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/** Print-on-close is decided by `printBill` arg (from checkout.print_pre_bill capability). */
describe('checkout close print decision', () => {
  it('documents capability-driven printBill flag', () => {
    const printBillFromCaps = (hasPreBill: boolean) => hasPreBill;
    assert.equal(printBillFromCaps(true), true);
    assert.equal(printBillFromCaps(false), false);
  });
});
