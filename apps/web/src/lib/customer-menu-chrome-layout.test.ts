import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CUSTOMER_MENU_CATEGORY_RAIL_DODGE_PL_CLASS,
  CUSTOMER_MENU_CATEGORY_RAIL_PAGE_HEIGHT_CLASS,
  CUSTOMER_MENU_CATEGORY_RAIL_WIDTH_CLASS,
  CUSTOMER_MENU_SHELL_WIDTH_CLASS,
  CUSTOMER_MENU_SUBCATEGORY_STICKY_SHELL_CLASS,
  customerMenuCatalogPaneClass,
  customerMenuCatalogPanePageScrollClass,
  customerMenuCategoryNavShellClass,
  customerMenuCategoryNavShellPageScrollClass,
  customerMenuCategoryRailClass,
  customerMenuCategoryRailPageScrollClass,
  customerMenuContentHostClass,
  customerMenuDualPaneRootClass,
  customerMenuNoticeTabShellClass,
  customerMenuPeerFloatRailClass,
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

  it('anchors notice + peer-float to content host (not viewport rem top)', () => {
    assert.match(customerMenuContentHostClass, /relative/);
    assert.match(customerMenuContentHostClass, /flex-1/);
    assert.match(customerMenuContentHostClass, /min-h-0/);
    assert.match(customerMenuContentHostClass, /overflow-hidden/);
    assert.match(customerMenuNoticeTabShellClass, /absolute/);
    assert.match(customerMenuNoticeTabShellClass, /inset-x-0/);
    assert.match(customerMenuNoticeTabShellClass, /top-0/);
    assert.doesNotMatch(customerMenuNoticeTabShellClass, /fixed/);
    assert.doesNotMatch(customerMenuNoticeTabShellClass, /3\.75rem|6\.5rem|safe-area/);
    assert.match(customerMenuPeerFloatRailClass, /absolute/);
    assert.match(customerMenuPeerFloatRailClass, /inset-x-0/);
    assert.match(customerMenuPeerFloatRailClass, /top-0/);
    assert.ok(
      customerMenuPeerFloatRailClass.includes(CUSTOMER_MENU_CATEGORY_RAIL_DODGE_PL_CLASS),
    );
    assert.doesNotMatch(customerMenuPeerFloatRailClass, /fixed/);
    assert.doesNotMatch(customerMenuPeerFloatRailClass, /3\.75rem|6\.5rem|safe-area/);
  });

  it('keeps sole left category rail width shared with peer-float dodge', () => {
    assert.equal(CUSTOMER_MENU_CATEGORY_RAIL_WIDTH_CLASS, 'w-[var(--mesa-menu-category-rail-w,4.75rem)]');
    assert.equal(CUSTOMER_MENU_CATEGORY_RAIL_DODGE_PL_CLASS, 'pl-[var(--mesa-menu-category-rail-w,4.75rem)]');
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
    // Flush sticky: no scrollport top padding, opaque chip bar.
    assert.doesNotMatch(customerMenuCatalogPaneClass, /(^|\s)p[ty]-/);
    assert.match(customerMenuCatalogPaneClass, /before:h-4/);
    assert.match(CUSTOMER_MENU_SUBCATEGORY_STICKY_SHELL_CLASS, /(^|\s)bg-brand-bg(\s|$)/);
    assert.doesNotMatch(CUSTOMER_MENU_SUBCATEGORY_STICKY_SHELL_CLASS, /backdrop-blur|bg-brand-bg\//);
  });

  it('page-scroll rail/shell use sole CSS container-height classes (no viewport calc)', () => {
    assert.equal(CUSTOMER_MENU_CATEGORY_RAIL_PAGE_HEIGHT_CLASS, 'mesa-menu-category-rail-page');
    assert.match(customerMenuCategoryNavShellPageScrollClass, /items-start/);
    assert.match(customerMenuCategoryNavShellPageScrollClass, /mesa-menu-category-nav-page/);
    assert.doesNotMatch(customerMenuCategoryNavShellPageScrollClass, /dvh/);
    assert.match(customerMenuCategoryRailPageScrollClass, /self-start/);
    assert.ok(
      customerMenuCategoryRailPageScrollClass.includes(CUSTOMER_MENU_CATEGORY_RAIL_PAGE_HEIGHT_CLASS),
    );
    assert.doesNotMatch(customerMenuCategoryRailPageScrollClass, /h-\[calc/);
    assert.match(customerMenuCategoryRailPageScrollClass, /overflow-y-auto/);
    assert.match(customerMenuCategoryRailPageScrollClass, /sticky/);
  });

  it('page-scroll catalog is not a scrollport (overflow stays on storefront only)', () => {
    assert.doesNotMatch(customerMenuCatalogPanePageScrollClass, /overflow-/);
    assert.match(customerMenuCatalogPaneClass, /overflow-x-hidden/);
    assert.match(customerMenuCatalogPaneClass, /overflow-y-auto/);
  });
});
