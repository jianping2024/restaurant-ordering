import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  STAFF_TOP_BAR_CONTENT_HEIGHT,
  STAFF_TOP_BAR_TOTAL_HEIGHT,
  STAFF_TOP_BAR_TRAILING_TEXT_MAX_CLASS,
  staffTopBarChrome,
  waiterStaffStickyChrome,
} from '@/lib/waiter-staff-sticky-chrome';

describe('staffTopBarChrome', () => {
  it('uses h-14 content row, safe-area insets, flex-1 brand, no overflow clip', () => {
    assert.equal(STAFF_TOP_BAR_CONTENT_HEIGHT, '3.5rem');
    assert.equal(
      STAFF_TOP_BAR_TOTAL_HEIGHT,
      'calc(3.5rem + env(safe-area-inset-top, 0px))',
    );
    assert.equal(STAFF_TOP_BAR_TRAILING_TEXT_MAX_CLASS, 'max-w-[5.5rem]');
    assert.match(staffTopBarChrome.headerClassName, /pt-\[env\(safe-area-inset-top/);
    assert.doesNotMatch(staffTopBarChrome.headerClassName, /overflow-/);
    assert.match(staffTopBarChrome.rowClassName, /safe-area-inset-left/);
    assert.match(staffTopBarChrome.rowClassName, /safe-area-inset-right/);
    assert.match(staffTopBarChrome.rowClassName, /h-14/);
    assert.match(staffTopBarChrome.brandClassName, /min-w-0/);
    assert.match(staffTopBarChrome.brandClassName, /flex-1/);
    assert.match(staffTopBarChrome.brandClassName, /items-baseline/);
    assert.doesNotMatch(staffTopBarChrome.brandClassName, /shrink-0/);
    assert.match(staffTopBarChrome.restaurantNameClassName, /font-heading/);
    assert.match(staffTopBarChrome.restaurantNameClassName, /text-brand-text-muted/);
    assert.match(staffTopBarChrome.rightClusterClassName, /ml-auto/);
    assert.match(staffTopBarChrome.rightClusterClassName, /min-w-0/);
    assert.doesNotMatch(staffTopBarChrome.rightClusterClassName, /flex-1/);
    assert.equal(
      waiterStaffStickyChrome.belowStaffTopBar,
      'top-[calc(3.5rem+env(safe-area-inset-top,0px))]',
    );
  });
});
