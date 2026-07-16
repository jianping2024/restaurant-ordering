import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { checkoutCloseShouldPrintBill } from '@/lib/waiter-table-checkout-close';

describe('checkoutCloseShouldPrintBill', () => {
  it('prints for frontdesk only', () => {
    assert.equal(checkoutCloseShouldPrintBill('frontdesk'), true);
    assert.equal(checkoutCloseShouldPrintBill('cashier'), false);
  });
});
