import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { customerOrderingAudience } from './customer-ordering-audience';

describe('customerOrderingAudience', () => {
  it('returns guest when staffAssisted is absent', () => {
    assert.equal(customerOrderingAudience(null), 'guest');
    assert.equal(customerOrderingAudience(undefined), 'guest');
  });

  it('returns staff-assisted when flow is resolved', () => {
    assert.equal(
      customerOrderingAudience({
        returnHref: '/dashboard/waiter/table-1',
        variant: 'staff',
        redirectAfterSubmit: true,
        showBillCta: false,
        skipGeoFence: true,
        skipFeedback: true,
        checkoutRedirectHref: null,
      }),
      'staff-assisted',
    );
  });
});
