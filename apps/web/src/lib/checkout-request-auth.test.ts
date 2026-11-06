import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { capabilitiesFromKeys } from './permissions/can';
import {
  checkoutRequestCallerFromCapabilities,
  resolveCheckoutRequestCaller,
} from './checkout-request-auth';

describe('checkoutRequestCallerFromCapabilities', () => {
  it('authorizes assist_bill only', () => {
    assert.equal(
      checkoutRequestCallerFromCapabilities(capabilitiesFromKeys(['checkout.assist_bill'])),
      'authorized_staff',
    );
  });

  it('forbids staff without assist_bill', () => {
    assert.equal(
      checkoutRequestCallerFromCapabilities(capabilitiesFromKeys(['dashboard.waiter_board.view'])),
      'forbidden_staff',
    );
    assert.equal(
      checkoutRequestCallerFromCapabilities(
        capabilitiesFromKeys(['checkout.confirm_payment', 'tables.checkout_close']),
      ),
      'forbidden_staff',
    );
  });
});

describe('resolveCheckoutRequestCaller', () => {
  it('is exported for bill route and checkout request API', () => {
    assert.equal(typeof resolveCheckoutRequestCaller, 'function');
  });
});

describe('resolveCheckoutRequestCaller guest phone', () => {
  it('is a customer whenever guest_client_id is present, without reading any session', async () => {
    assert.deepEqual(
      await resolveCheckoutRequestCaller('any-slug', { guestClientId: 'not-even-a-uuid' }),
      { kind: 'customer' },
    );
  });
});
