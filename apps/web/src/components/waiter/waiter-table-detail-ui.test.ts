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
  assert.match(waiterDetailLayout.pageFooterSlot, /mt-4/);
  assert.match(waiterDetailLayout.pageFooterSlot, /min-h-12/);
  assert.match(waiterDetailLayout.pageBodySlot, /min-h-/);
  assert.match(waiterDetailLayout.pageFooter, /flex/);
  assert.doesNotMatch(waiterDetailLayout.pageFooter, /mt-4/);
  assert.match(waiterDetailLayout.secondaryAction, /w-full/);
});

test('floor list body is one tier for ordered dishes and buffet package names', () => {
  assert.match(waiterFloorType.listBody, /text-lg/);
  assert.match(waiterFloorType.listBody, /font-semibold/);
  assert.match(waiterFloorType.listBody, /text-brand-text/);
  assert.equal(waiterDetailLayout.orderedItemsTitle.includes(waiterFloorType.listBody), true);
  assert.equal(waiterDetailLayout.orderedItemLabel, waiterFloorType.listBodyTruncate);
  assert.equal(waiterDetailLayout.orderedItemQty, waiterFloorType.listQty);
  assert.match(waiterDetailLayout.orderedItemCode, /text-lg/);
  assert.match(waiterFloorType.priceLine, /text-\[15px\]/);
  assert.match(waiterFloorType.priceLine, /text-brand-text/);
  assert.doesNotMatch(waiterFloorType.priceLine, /muted/);
  assert.match(waiterFloorType.guestLabel, /text-\[15px\]/);
});

test('page identity and ordered-items share one sticky chrome stack', () => {
  assert.match(waiterStaffStickyChrome.belowStaffTopBar, /safe-area-inset-top/);
  assert.match(waiterStaffStickyChrome.belowPageHeading, /safe-area-inset-top/);
  assert.match(waiterStaffStickyChrome.belowPageHeading, /3\.5rem\+3\.5rem/);
  assert.equal(
    waiterDetailLayout.pageHeading.includes(waiterStaffStickyChrome.belowStaffTopBar),
    true,
  );
  assert.match(waiterDetailLayout.pageHeading, /sticky/);
  assert.match(waiterDetailLayout.pageHeading, /bg-brand-bg/);
  assert.match(waiterDetailLayout.pageHeadingRow, /min-w-0/);
  assert.match(waiterDetailLayout.pageHeading, /h-14/);
  assert.doesNotMatch(waiterDetailLayout.pageHeading, /py-3/);
  assert.match(waiterDetailLayout.pageHeadingTitle, /truncate/);
  assert.match(waiterDetailLayout.orderedItemsMoneyChrome, /sticky/);
  assert.equal(
    waiterDetailLayout.orderedItemsMoneyChrome.includes(waiterStaffStickyChrome.belowPageHeading),
    true,
  );
  assert.doesNotMatch(waiterDetailLayout.orderedItemsMoneyChrome, /top-14\b/);
  assert.match(waiterDetailLayout.orderedItemsMoneyChrome, /bg-brand-card/);
  assert.match(waiterDetailLayout.orderedItemsMoneyChrome, /justify-end/);
  assert.doesNotMatch(waiterDetailLayout.orderedItemsMoneyChrome, /flex-col-reverse/);
  assert.doesNotMatch(waiterDetailLayout.orderedItemsMoneyChrome, /sm:flex-row/);
  assert.match(waiterDetailLayout.sectionBody, /pt-2/);
  assert.match(waiterDetailLayout.orderedItemsTitleRow, /shrink-0/);
  assert.match(waiterDetailLayout.orderedItemsTitle, /whitespace-nowrap/);
  assert.match(waiterDetailLayout.orderedItemsTitle, /text-lg/);
  assert.match(waiterDetailLayout.orderedItemsTotal, /text-lg/);
  assert.match(waiterDetailLayout.orderedItemsTotal, /tabular-nums/);
  assert.match(waiterDetailLayout.orderedItemLabel, /text-lg/);
  assert.match(waiterDetailLayout.orderedItemQty, /text-lg/);
  assert.doesNotMatch(waiterDetailLayout.orderedItemLabel, /font-mono/);
});

test('ordered-item row is a left cluster (identity —gap-8— qty/actions; label not flex-1)', () => {
  assert.match(waiterDetailLayout.orderedItemRow, /flex/);
  assert.match(waiterDetailLayout.orderedItemRow, /gap-8/);
  assert.match(waiterDetailLayout.orderedItemRow, /items-center/);
  assert.doesNotMatch(waiterDetailLayout.orderedItemRow, /justify-between/);
  assert.match(waiterDetailLayout.orderedItemIdentity, /flex/);
  assert.match(waiterDetailLayout.orderedItemIdentity, /min-w-0/);
  assert.match(waiterDetailLayout.orderedItemCode, /shrink-0/);
  assert.match(waiterDetailLayout.orderedItemCode, /tabular-nums/);
  assert.doesNotMatch(waiterDetailLayout.orderedItemLabel, /flex-1/);
  assert.match(waiterDetailLayout.orderedItemLabel, /truncate/);
  assert.match(waiterDetailLayout.orderedItemStatus, /shrink-0/);
  assert.doesNotMatch(waiterDetailLayout.orderedItemStatus, /muted/);
  assert.match(waiterDetailLayout.orderedItemQty, /shrink-0/);
  assert.match(waiterDetailLayout.orderedItemActions, /shrink-0/);
  assert.match(waiterDetailLayout.orderedItemActions, /gap-2/);
  assert.equal(
    'orderedItemTextCol' in waiterDetailLayout,
    false,
    'retired text-col — identity cluster is the sole name/status wrapper',
  );
});

test('ordered-items panel: status in identity cluster; qty with actions (one left-cluster shape)', async () => {
  const { readFile } = await import('node:fs/promises');
  const { fileURLToPath } = await import('node:url');
  const { dirname, join } = await import('node:path');
  const here = dirname(fileURLToPath(import.meta.url));
  const src = await readFile(join(here, 'WaiterTableDetailLayout.tsx'), 'utf8');
  const panel = src.slice(src.indexOf('WaiterTableOrderedItemsPanel'));
  assert.match(panel, /waiterDetailLayout\.orderedItemIdentity/);
  assert.match(panel, /waiterDetailLayout\.orderedItemCode/);
  assert.match(panel, /line\.itemCode/);
  assert.match(panel, /waiterDetailLayout\.orderedItemStatus/);
  assert.match(panel, /waiterDetailLayout\.orderedItemLabel/);
  assert.match(panel, /waiterDetailLayout\.orderedItemQty/);
  assert.doesNotMatch(panel, /orderedItemTextCol/);
  // status lives inside identity, not as a muted second line
  assert.doesNotMatch(
    panel,
    /statusLabel[\s\S]{0,120}orderedItemChargeableHint/,
  );
  // qty is grouped with actions (after identity), not a flex-1 spacer sibling
  const identityIdx = panel.indexOf('orderedItemIdentity');
  const statusIdx = panel.indexOf('orderedItemStatus');
  const qtyIdx = panel.indexOf('orderedItemQty');
  assert.ok(identityIdx >= 0 && statusIdx > identityIdx && qtyIdx > statusIdx);
});

test('ordered-items panel splits money chrome from list title (one representation)', async () => {
  const { readFile } = await import('node:fs/promises');
  const { fileURLToPath } = await import('node:url');
  const { dirname, join } = await import('node:path');
  const here = dirname(fileURLToPath(import.meta.url));
  const src = await readFile(join(here, 'WaiterTableDetailLayout.tsx'), 'utf8');
  const panel = src.slice(src.indexOf('WaiterTableOrderedItemsPanel'));
  assert.match(panel, /waiterDetailLayout\.orderedItemsMoneyChrome/);
  assert.match(panel, /waiterDetailLayout\.sectionBody/);
  assert.match(panel, /waiterDetailLayout\.orderedItemsTitle/);
  assert.doesNotMatch(panel, /orderedItemsHeader\b/);
  assert.doesNotMatch(panel, /orderedItemsHeaderActions/);
  assert.doesNotMatch(panel, /flex-col-reverse/);
});

test('table detail cold load uses one shared content skeleton (no parallel pulse tree)', async () => {
  const { readFile } = await import('node:fs/promises');
  const { fileURLToPath } = await import('node:url');
  const { dirname, join } = await import('node:path');
  const here = dirname(fileURLToPath(import.meta.url));
  const detail = await readFile(join(here, 'WaiterTableDetail.tsx'), 'utf8');
  assert.match(detail, /WaiterTableDetailContentSkeleton/);
  assert.match(detail, /paintPhase/);
  assert.match(detail, /pageBodySlot/);
  assert.match(detail, /pageFooterSlot/);
  assert.doesNotMatch(detail, /detailBodyReady/);
  assert.doesNotMatch(detail, /showColdContent/);
  assert.doesNotMatch(detail, /animate-pulse/);
  assert.match(detail, /isAuthoritativeIdleWaiterTableBoot/);
  const loading = await readFile(
    join(here, '../../app/dashboard/waiter/[tableId]/loading.tsx'),
    'utf8',
  );
  assert.match(loading, /WaiterTableDetailContentSkeleton/);
  assert.doesNotMatch(loading, /waiterUi\.cardSurface/);
});
