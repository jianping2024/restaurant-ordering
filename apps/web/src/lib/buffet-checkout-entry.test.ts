import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hasEnteredCheckout, type CheckoutEntrySignals } from '@/lib/buffet-checkout-entry';

const none: CheckoutEntrySignals = {
  sessionBilling: false,
  checkoutRequested: false,
  calledTicketCount: 0,
  collectedPaymentCount: 0,
  invoiceJobCount: 0,
};

describe('hasEnteredCheckout', () => {
  it('is false before any checkout signal (ordered or not)', () => {
    assert.equal(hasEnteredCheckout(none), false);
  });

  it('called checkout / any collection / any invoice locks the buffet', () => {
    assert.equal(hasEnteredCheckout({ ...none, sessionBilling: true }), true);
    assert.equal(hasEnteredCheckout({ ...none, checkoutRequested: true }), true);
    assert.equal(hasEnteredCheckout({ ...none, calledTicketCount: 1 }), true);
    assert.equal(hasEnteredCheckout({ ...none, collectedPaymentCount: 1 }), true);
    assert.equal(hasEnteredCheckout({ ...none, invoiceJobCount: 1 }), true);
  });
});
