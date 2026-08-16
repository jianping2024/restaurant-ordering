import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatCustomerMenuItemPrice } from '@/lib/menu-item-price-display';

describe('formatCustomerMenuItemPrice', () => {
  it('shows free label for zero when treatZeroAsFree', () => {
    assert.equal(
      formatCustomerMenuItemPrice(0, { freeLabel: '免费', treatZeroAsFree: true }),
      '免费',
    );
  });

  it('shows euro for zero when not treating as free', () => {
    assert.equal(
      formatCustomerMenuItemPrice(0, { freeLabel: '免费', treatZeroAsFree: false }),
      '€0.00',
    );
  });

  it('formats paid prices', () => {
    assert.equal(
      formatCustomerMenuItemPrice(4.5, { freeLabel: '免费', treatZeroAsFree: true }),
      '€4.50',
    );
  });
});
