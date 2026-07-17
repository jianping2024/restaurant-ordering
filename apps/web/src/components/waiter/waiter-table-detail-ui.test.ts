import assert from 'node:assert/strict';
import test from 'node:test';
import { waiterStaffStickyChrome } from '../../lib/waiter-staff-sticky-chrome';
import {
  buffetDetailPackageGrid,
  buffetStripSectionClass,
  waiterDetailLayout,
  waiterFloorType,
} from './waiter-table-detail-ui';

test('buffet strip edge sections align to card gutter without ad-hoc padding overrides', () => {
  assert.match(buffetStripSectionClass('start'), /xl:pr-4/);
  assert.doesNotMatch(buffetStripSectionClass('start'), /xl:pl-/);
  assert.match(buffetStripSectionClass('end'), /xl:items-end/);
  assert.match(buffetStripSectionClass('end'), /xl:pl-4/);
  assert.doesNotMatch(buffetStripSectionClass('end'), /xl:pr-/);
});

test('buffet detail summary aligns actions under guest stepper columns', () => {
  assert.match(buffetDetailPackageGrid, /sm:grid-cols-\[minmax\(0,1\.2fr\)_repeat\(2,minmax\(0,0\.8fr\)\)\]/);
  assert.match(waiterDetailLayout.buffetDetailSummaryRow, /mt-4/);
  assert.match(waiterDetailLayout.buffetDetailSummaryActions, /justify-end/);
  assert.match(waiterDetailLayout.buffetDetailSummaryActions, /sm:col-span-2/);
});

test('primary session actions share one layout class', () => {
  assert.match(waiterDetailLayout.primaryAction, /whitespace-nowrap/);
  assert.match(waiterDetailLayout.primaryAction, /sm:w-auto/);
  assert.match(waiterDetailLayout.cardBody, /px-4/);
  assert.equal(waiterDetailLayout.sectionBody.includes('px-4'), true);
});

test('back-to-board footer uses page footer spacing and secondary action width', () => {
  assert.match(waiterDetailLayout.pageFooter, /mt-4/);
  assert.match(waiterDetailLayout.secondaryAction, /w-full/);
});

test('floor list body is one tier for ordered dishes and buffet package names', () => {
  assert.match(waiterFloorType.listBody, /text-lg/);
  assert.match(waiterFloorType.listBody, /font-semibold/);
  assert.match(waiterFloorType.listBody, /text-brand-text/);
  assert.equal(waiterDetailLayout.orderedItemsTitle, waiterFloorType.listBody);
  assert.match(waiterDetailLayout.orderedItemLabel, /text-lg/);
  assert.match(waiterFloorType.priceLine, /text-\[15px\]/);
  assert.match(waiterFloorType.priceLine, /text-brand-text/);
  assert.doesNotMatch(waiterFloorType.priceLine, /muted/);
  assert.match(waiterFloorType.guestLabel, /text-\[15px\]/);
});

test('page identity and ordered-items share one sticky chrome stack', () => {
  assert.equal(waiterStaffStickyChrome.belowStaffTopBar, 'top-14');
  assert.equal(waiterStaffStickyChrome.belowPageHeading, 'top-28');
  assert.match(waiterDetailLayout.pageHeading, /sticky/);
  assert.match(waiterDetailLayout.pageHeading, new RegExp(waiterStaffStickyChrome.belowStaffTopBar));
  assert.match(waiterDetailLayout.pageHeading, /bg-brand-bg/);
  assert.match(waiterDetailLayout.pageHeadingRow, /min-w-0/);
  assert.match(waiterDetailLayout.pageHeading, /h-14/);
  assert.doesNotMatch(waiterDetailLayout.pageHeading, /py-3/);
  assert.match(waiterDetailLayout.pageHeadingTitle, /truncate/);
  assert.match(waiterDetailLayout.orderedItemsHeader, /sticky/);
  assert.match(
    waiterDetailLayout.orderedItemsHeader,
    new RegExp(waiterStaffStickyChrome.belowPageHeading),
  );
  assert.doesNotMatch(waiterDetailLayout.orderedItemsHeader, /top-14/);
  assert.match(waiterDetailLayout.orderedItemsHeader, /bg-brand-card/);
  assert.match(waiterDetailLayout.orderedItemsTitle, /text-lg/);
  assert.match(waiterDetailLayout.orderedItemsTotal, /text-lg/);
  assert.match(waiterDetailLayout.orderedItemsTotal, /tabular-nums/);
  assert.match(waiterDetailLayout.orderedItemLabel, /text-lg/);
  assert.match(waiterDetailLayout.orderedItemQty, /text-lg/);
  assert.doesNotMatch(waiterDetailLayout.orderedItemLabel, /font-mono/);
});

test('ordered-item row keeps name, qty, and minus as one left-aligned cluster', () => {
  assert.match(waiterDetailLayout.orderedItemRow, /flex/);
  assert.match(waiterDetailLayout.orderedItemRow, /max-w-full/);
  assert.match(waiterDetailLayout.orderedItemRow, /gap-8/);
  assert.doesNotMatch(waiterDetailLayout.orderedItemRow, /justify-between/);
  assert.doesNotMatch(waiterDetailLayout.orderedItemLabel, /flex-1/);
  assert.match(waiterDetailLayout.orderedItemLabel, /truncate/);
  assert.match(waiterDetailLayout.orderedItemQty, /shrink-0/);
  assert.match(waiterDetailLayout.orderedItemActions, /shrink-0/);
  assert.match(waiterDetailLayout.orderedItemActions, /gap-2/);
});
