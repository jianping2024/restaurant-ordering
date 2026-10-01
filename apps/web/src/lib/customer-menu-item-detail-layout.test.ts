import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CUSTOMER_MENU_BOTTOM_SAFE_AREA_PB_CLASS } from './customer-menu-bottom-bar-layout';
import {
  CUSTOMER_MENU_ITEM_DETAIL_HERO_CLASS,
  customerMenuItemDetailBodyClass,
  customerMenuItemDetailContentClass,
  customerMenuItemDetailFooterClass,
  customerMenuItemDetailHostClass,
  customerMenuItemDetailPanelClass,
} from './customer-menu-item-detail-layout';
import { MENU_IMAGE_ASPECT_CLASS, MENU_IMAGE_OBJECT_FIT_CLASS, MENU_IMAGE_WELL_BG_CLASS } from './menu-image';

describe('customerMenuItemDetailLayout', () => {
  it('hosts phone fullscreen stretch and lg centered dialog', () => {
    assert.match(customerMenuItemDetailHostClass, /fixed inset-0/);
    assert.match(customerMenuItemDetailHostClass, /lg:items-center/);
    assert.match(customerMenuItemDetailHostClass, /overscroll-none/);
    assert.match(customerMenuItemDetailPanelClass, /max-lg:h-full/);
    assert.match(customerMenuItemDetailPanelClass, /lg:max-w-lg/);
    assert.match(customerMenuItemDetailPanelClass, /overscroll-none/);
    assert.doesNotMatch(customerMenuItemDetailPanelClass, /68rem/);
  });

  it('hero stays 4:3 with ~⅓ viewport height cap (not half-screen pin)', () => {
    assert.match(CUSTOMER_MENU_ITEM_DETAIL_HERO_CLASS, /aspect-\[4\/3\]/);
    assert.match(
      CUSTOMER_MENU_ITEM_DETAIL_HERO_CLASS,
      new RegExp(MENU_IMAGE_ASPECT_CLASS.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    );
    assert.match(
      CUSTOMER_MENU_ITEM_DETAIL_HERO_CLASS,
      new RegExp(MENU_IMAGE_WELL_BG_CLASS.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    );
    assert.match(CUSTOMER_MENU_ITEM_DETAIL_HERO_CLASS, /max-h-\[min\(33vh,14rem\)\]/);
    assert.doesNotMatch(CUSTOMER_MENU_ITEM_DETAIL_HERO_CLASS, /52vh/);
    assert.doesNotMatch(CUSTOMER_MENU_ITEM_DETAIL_HERO_CLASS, /bg-brand-border/);
    assert.equal(MENU_IMAGE_OBJECT_FIT_CLASS, 'object-contain object-center');
    assert.doesNotMatch(MENU_IMAGE_OBJECT_FIT_CLASS, /object-cover/);
  });

  it('one scroll column for hero+copy; content pad separate from scroller', () => {
    assert.match(customerMenuItemDetailBodyClass, /modal-scroll/);
    assert.match(customerMenuItemDetailBodyClass, /overflow-y-auto/);
    assert.match(customerMenuItemDetailBodyClass, /overscroll-contain/);
    assert.doesNotMatch(customerMenuItemDetailBodyClass, /px-5/);
    assert.match(customerMenuItemDetailContentClass, /px-5/);
    assert.match(customerMenuItemDetailContentClass, /pt-5/);
  });

  it('footer reuses sole customer menu bottom safe-area pad', () => {
    assert.match(
      customerMenuItemDetailFooterClass,
      new RegExp(CUSTOMER_MENU_BOTTOM_SAFE_AREA_PB_CLASS.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    );
    assert.doesNotMatch(customerMenuItemDetailFooterClass, /pb-\[max\(/);
  });
});
