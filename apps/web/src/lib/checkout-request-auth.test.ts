import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CHECKOUT_REQUEST_AUTHORIZED_STAFF_ROLES,
  resolveCheckoutRequestCaller,
} from './checkout-request-auth';

describe('CHECKOUT_REQUEST_AUTHORIZED_STAFF_ROLES', () => {
  it('allows frontdesk and cashier only', () => {
    assert.deepEqual(CHECKOUT_REQUEST_AUTHORIZED_STAFF_ROLES, ['frontdesk', 'cashier']);
  });
});

describe('resolveCheckoutRequestCaller', () => {
  it('is exported for bill route and checkout request API', () => {
    assert.equal(typeof resolveCheckoutRequestCaller, 'function');
  });
});
