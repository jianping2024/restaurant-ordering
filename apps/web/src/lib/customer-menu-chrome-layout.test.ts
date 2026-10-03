import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CUSTOMER_MENU_CATEGORY_RAIL_DODGE_PL_CLASS,
  CUSTOMER_MENU_CATEGORY_RAIL_WIDTH_CLASS,
  CUSTOMER_MENU_NOTICE_TAB_TOP_CLASS,
  CUSTOMER_MENU_SHELL_WIDTH_CLASS,
  CUSTOMER_MENU_SUBCATEGORY_STICKY_SHELL_CLASS,
  customerMenuCatalogPaneClass,
  customerMenuCategoryNavShellClass,
  customerMenuCategoryRailClass,
  customerMenuDualPaneRootClass,
  customerMenuFixedShellDockClass,
  customerMenuHeaderTrailingSlotClass,
  customerMenuNoticeTabShellClass,
  customerMenuShellRootClass,
} from './customer-menu-chrome-layout';


describe('customerMenuChromeLayout', () => {
  it('uses sole shell width: phone max-w-mobile + lg widen', () => {
    assert.match(CUSTOMER_MENU_SHELL_WIDTH_CLASS, /max-w-mobile/);
    assert.match(CUSTOMER_MENU_SHELL_WIDTH_CLASS, /lg:max-w-\[68rem\]/);
    assert.equal(
      CUSTOMER_MENU_SHELL_WIDTH_CLASS,
      'w-full max-w-mobile lg:max-w-[68rem]',
    );
    assert.ok(customerMenuShellRootClass.includes(CUSTOMER_MENU_SHELL_WIDTH_CLASS));
  });

  it('docks fixed overlays to the centered shell', () => {
    assert.match(customerMenuFixedShellDockClass, /left-1\/2/);
    assert.match(customerMenuFixedShellDockClass, /-translate-x-1\/2/);
    assert.ok(customerMenuNoticeTabShellClass.includes(CUSTOMER_MENU_SHELL_WIDTH_CLASS));
    assert.ok(customerMenuNoticeTabShellClass.includes(CUSTOMER_MENU_NOTICE_TAB_TOP_CLASS));
  });

  it('keeps header trailing controls from shrinking', () => {
    assert.equal(customerMenuHeaderTrailingSlotClass, 'shrink-0');
  });

  it('keeps notice tab below identity header (no top category strip)', () => {
    assert.match(CUSTOMER_MENU_NOTICE_TAB_TOP_CLASS, /3\.75rem/);
    assert.doesNotMatch(CUSTOMER_MENU_NOTICE_TAB_TOP_CLASS, /6\.5rem/);
  });

  it('keeps sole left category rail width shared with peer-float dodge', () => {
    assert.equal(CUSTOMER_MENU_CATEGORY_RAIL_WIDTH_CLASS, 'w-[4.75rem]');
    assert.equal(CUSTOMER_MENU_CATEGORY_RAIL_DODGE_PL_CLASS, 'pl-[4.75rem]');
    assert.ok(customerMenuCategoryRailClass.includes(CUSTOMER_MENU_CATEGORY_RAIL_WIDTH_CLASS));
    assert.match(customerMenuCategoryRailClass, /overflow-y-auto/);
    assert.match(customerMenuCategoryRailClass, /overscroll-y-contain/);
    assert.doesNotMatch(customerMenuCategoryRailClass, /sticky/);
  });

  it('uses one dual-pane scroll contract (nav shell width + catalog overscroll)', () => {
    assert.match(customerMenuDualPaneRootClass, /overflow-hidden/);
    assert.match(customerMenuDualPaneRootClass, /flex-col/);
    assert.equal(
      customerMenuCategoryNavShellClass,
      'flex min-h-0 min-w-0 w-full flex-1 overflow-hidden',
    );
    assert.match(customerMenuCatalogPaneClass, /overflow-y-auto/);
    assert.match(customerMenuCatalogPaneClass, /overflow-x-hidden/);
    assert.match(customerMenuCatalogPaneClass, /overscroll-y-contain/);
    assert.match(CUSTOMER_MENU_SUBCATEGORY_STICKY_SHELL_CLASS, /sticky/);
    assert.match(CUSTOMER_MENU_SUBCATEGORY_STICKY_SHELL_CLASS, /top-0/);
    assert.match(CUSTOMER_MENU_SUBCATEGORY_STICKY_SHELL_CLASS, /mesa-chip-scroll/);
  });
});
