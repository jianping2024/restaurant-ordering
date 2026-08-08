import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { capabilitiesFromKeys } from './permissions/can';
import {
  CHECKOUT_REQUEST_PERMISSIONS,
  checkoutRequestCallerFromCapabilities,
  resolveCheckoutRequestCaller,
} from './checkout-request-auth';

describe('CHECKOUT_REQUEST_PERMISSIONS', () => {
  it('uses checkout capability keys only', () => {
    assert.deepEqual(CHECKOUT_REQUEST_PERMISSIONS, [
      'checkout.request_whole_table',
      'checkout.assist_bill',
    ]);
  });
});

describe('checkoutRequestCallerFromCapabilities', () => {
  it('authorizes request_whole_table or assist_bill', () => {
    assert.equal(
      checkoutRequestCallerFromCapabilities(
        capabilitiesFromKeys(['checkout.request_whole_table']),
      ),
      'authorized_staff',
    );
    assert.equal(
      checkoutRequestCallerFromCapabilities(capabilitiesFromKeys(['checkout.assist_bill'])),
      'authorized_staff',
    );
  });

  it('forbids staff without checkout request capabilities', () => {
    assert.equal(
      checkoutRequestCallerFromCapabilities(capabilitiesFromKeys(['dashboard.waiter_board.view'])),
      'forbidden_staff',
    );
  });
});

describe('resolveCheckoutRequestCaller', () => {
  it('is exported for bill route and checkout request API', () => {
    assert.equal(typeof resolveCheckoutRequestCaller, 'function');
  });
});
