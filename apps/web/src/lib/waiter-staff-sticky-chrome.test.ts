import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  STAFF_TOP_BAR_CONTENT_HEIGHT,
  STAFF_TOP_BAR_TOTAL_HEIGHT,
  STAFF_TOP_BAR_TRAILING_TEXT_MAX_CLASS,
  checkoutSettlementBarStickyShellClass,
  dashboardStickyToolbarShellClass,
  staffTopBarChrome,
  waiterStaffStickyChrome,
} from '@/lib/waiter-staff-sticky-chrome';
import { STAFF_SHELL_CONTENT_CLASS } from '@/lib/staff-shell-layout';

describe('staffTopBarChrome', () => {
  it('three zones: brand yields on mobile; nav fills middle on lg; trailing flush right', () => {
    assert.equal(STAFF_TOP_BAR_CONTENT_HEIGHT, '3.5rem');
    assert.equal(
      STAFF_TOP_BAR_TOTAL_HEIGHT,
      'calc(3.5rem + env(safe-area-inset-top, 0px))',
    );
    assert.equal(STAFF_TOP_BAR_TRAILING_TEXT_MAX_CLASS, 'max-w-[5.5rem]');
    assert.match(staffTopBarChrome.headerClassName, /pt-\[env\(safe-area-inset-top/);
    assert.doesNotMatch(staffTopBarChrome.headerClassName, /overflow-/);
    assert.match(staffTopBarChrome.rowClassName, /h-14/);
    assert.match(staffTopBarChrome.rowClassName, /flex-nowrap/);
    assert.match(staffTopBarChrome.rowClassName, /max-w-\[120rem\]/);
    assert.match(staffTopBarChrome.rowClassName, /mx-auto/);
    assert.match(staffTopBarChrome.rowClassName, /safe-area-inset-left/);
    assert.doesNotMatch(
      staffTopBarChrome.rowClassName.replace(STAFF_SHELL_CONTENT_CLASS, ''),
      /pl-\[|pr-\[/,
    );
    assert.match(staffTopBarChrome.brandClassName, /min-w-0/);
    assert.match(staffTopBarChrome.brandClassName, /flex-1/);
    assert.match(staffTopBarChrome.brandClassName, /lg:flex-initial/);
    assert.doesNotMatch(staffTopBarChrome.brandClassName, /shrink-0/);
    assert.doesNotMatch(staffTopBarChrome.brandClassName, /min-w-\[7rem\]/);
    assert.match(staffTopBarChrome.restaurantNameClassName, /font-heading/);
    assert.match(staffTopBarChrome.restaurantNameClassName, /\btext-base\b/);
    assert.match(staffTopBarChrome.restaurantNameClassName, /text-brand-text/);
    assert.match(staffTopBarChrome.restaurantNameClassName, /whitespace-nowrap/);
    assert.match(staffTopBarChrome.restaurantNameClassName, /overflow-hidden/);
    assert.match(staffTopBarChrome.restaurantNameClassName, /min-w-0/);
    assert.doesNotMatch(staffTopBarChrome.restaurantNameClassName, /shrink-0/);
    assert.doesNotMatch(staffTopBarChrome.restaurantNameClassName, /\btruncate\b/);
    assert.doesNotMatch(staffTopBarChrome.restaurantNameClassName, /text-brand-text-muted/);
    assert.doesNotMatch(staffTopBarChrome.restaurantNameClassName, /\btext-sm\b/);
    assert.match(staffTopBarChrome.restaurantNameMeasureClassName, /whitespace-nowrap/);
    assert.match(staffTopBarChrome.restaurantNameMeasureClassName, /font-heading/);
    assert.doesNotMatch(staffTopBarChrome.restaurantNameMeasureClassName, /max-w-full/);
    assert.match(staffTopBarChrome.navClassName, /shrink-0/);
    assert.match(staffTopBarChrome.navClassName, /lg:flex-1/);
    assert.match(staffTopBarChrome.navClassName, /lg:min-w-0/);
    assert.doesNotMatch(staffTopBarChrome.navClassName, /ml-auto/);
    assert.doesNotMatch(staffTopBarChrome.navClassName, /justify-end/);
    assert.match(staffTopBarChrome.trailingClassName, /shrink-0/);
    assert.doesNotMatch(staffTopBarChrome.trailingClassName, /flex-1/);
    assert.doesNotMatch(staffTopBarChrome.trailingClassName, /justify-end/);
    assert.equal(
      waiterStaffStickyChrome.belowStaffTopBar,
      'top-[calc(3.5rem+env(safe-area-inset-top,0px))]',
    );
  });
});

describe('checkoutSettlementBarStickyShellClass', () => {
  it('sticks under staff top bar with sole brand-bg fill — never bare top-0 or card fill', () => {
    assert.match(checkoutSettlementBarStickyShellClass, /sticky/);
    assert.match(
      checkoutSettlementBarStickyShellClass,
      /top-\[calc\(3\.5rem\+env\(safe-area-inset-top/,
    );
    assert.doesNotMatch(checkoutSettlementBarStickyShellClass, /\btop-0\b/);
    assert.ok(
      checkoutSettlementBarStickyShellClass.includes(waiterStaffStickyChrome.belowStaffTopBar),
    );
    assert.match(checkoutSettlementBarStickyShellClass, /bg-brand-bg/);
    assert.doesNotMatch(checkoutSettlementBarStickyShellClass, /bg-brand-card/);
  });
});

describe('dashboardStickyToolbarShellClass', () => {
  it('sticks under staff top bar with opaque paper fill — never bare top-0', () => {
    assert.match(dashboardStickyToolbarShellClass, /sticky/);
    assert.ok(
      dashboardStickyToolbarShellClass.includes(waiterStaffStickyChrome.belowStaffTopBar),
    );
    assert.doesNotMatch(dashboardStickyToolbarShellClass, /\btop-0\b/);
    assert.match(dashboardStickyToolbarShellClass, /bg-brand-bg/);
    assert.doesNotMatch(dashboardStickyToolbarShellClass, /bg-brand-card/);
  });
});
