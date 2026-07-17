import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buffetDetailPackageGrid,
  buffetStripSectionClass,
  waiterDetailLayout,
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

test('ordered-items card typography uses text-lg and sticky chrome under top bar', () => {
  assert.match(waiterDetailLayout.orderedItemsHeader, /sticky/);
  assert.match(waiterDetailLayout.orderedItemsHeader, /top-14/);
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
