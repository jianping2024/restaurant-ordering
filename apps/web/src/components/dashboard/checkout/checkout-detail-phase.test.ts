import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CheckoutPathChooserBackButton } from './checkout-detail-phase';

describe('checkout-detail-phase', () => {
  it('exports sole cancel control', () => {
    assert.equal(typeof CheckoutPathChooserBackButton, 'function');
  });
});
