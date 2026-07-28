import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  STAFF_TOP_BAR_CONTENT_HEIGHT,
  STAFF_TOP_BAR_TOTAL_HEIGHT,
  staffTopBarChrome,
  waiterStaffStickyChrome,
} from '@/lib/waiter-staff-sticky-chrome';

describe('staffTopBarChrome', () => {
  it('uses h-14 content row, safe-area insets, and content-sized nav', () => {
    assert.equal(STAFF_TOP_BAR_CONTENT_HEIGHT, '3.5rem');
    assert.equal(
      STAFF_TOP_BAR_TOTAL_HEIGHT,
      'calc(3.5rem + env(safe-area-inset-top, 0px))',
    );
    assert.match(staffTopBarChrome.headerClassName, /pt-\[env\(safe-area-inset-top/);
    assert.match(staffTopBarChrome.rowClassName, /safe-area-inset-left/);
    assert.match(staffTopBarChrome.rowClassName, /safe-area-inset-right/);
    assert.match(staffTopBarChrome.rowClassName, /h-14/);
    assert.match(staffTopBarChrome.leadingClassName, /flex-1/);
    assert.match(staffTopBarChrome.leadingClassName, /items-stretch/);
    assert.match(staffTopBarChrome.navClassName, /shrink-0/);
    assert.doesNotMatch(staffTopBarChrome.navClassName, /flex-1/);
    assert.doesNotMatch(staffTopBarChrome.navClassName, /overflow-x-auto/);
    assert.equal(
      waiterStaffStickyChrome.belowStaffTopBar,
      'top-[calc(3.5rem+env(safe-area-inset-top,0px))]',
    );
  });
});
