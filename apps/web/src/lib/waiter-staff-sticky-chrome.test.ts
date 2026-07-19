import assert from 'node:assert/strict';
import test from 'node:test';
import {
  STAFF_TOP_BAR_CONTENT_HEIGHT,
  STAFF_TOP_BAR_TOTAL_HEIGHT,
  staffTopBarChrome,
  waiterStaffStickyChrome,
} from './waiter-staff-sticky-chrome';

test('staff top bar chrome uses one height + safe-area contract', () => {
  assert.equal(STAFF_TOP_BAR_CONTENT_HEIGHT, '3.5rem');
  assert.equal(
    STAFF_TOP_BAR_TOTAL_HEIGHT,
    'calc(3.5rem + env(safe-area-inset-top, 0px))',
  );
  assert.match(staffTopBarChrome.headerClassName, /pt-\[env\(safe-area-inset-top/);
  assert.match(staffTopBarChrome.rowClassName, /safe-area-inset-left/);
  assert.match(staffTopBarChrome.rowClassName, /safe-area-inset-right/);
  assert.match(staffTopBarChrome.rowClassName, /h-14/);
  assert.match(staffTopBarChrome.navClassName, /self-stretch/);
  assert.match(staffTopBarChrome.navClassName, /overflow-x-auto/);
  assert.equal(
    waiterStaffStickyChrome.belowStaffTopBar,
    'top-[calc(3.5rem+env(safe-area-inset-top,0px))]',
  );
  assert.equal(
    waiterStaffStickyChrome.belowPageHeading,
    'top-[calc(3.5rem+3.5rem+env(safe-area-inset-top,0px))]',
  );
  assert.doesNotMatch(waiterStaffStickyChrome.belowStaffTopBar, /\$\{/);
  assert.doesNotMatch(waiterStaffStickyChrome.belowPageHeading, /\$\{/);
});
