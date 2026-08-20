import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CUSTOMER_MENU_ITEM_DETAIL_HERO_CLASS,
  customerMenuItemDetailHostClass,
  customerMenuItemDetailPanelClass,
} from './customer-menu-item-detail-layout';
import { MENU_IMAGE_ASPECT_CLASS, MENU_IMAGE_OBJECT_FIT_CLASS } from './menu-image';

describe('customerMenuItemDetailLayout', () => {
  it('hosts phone fullscreen stretch and lg centered dialog', () => {
    assert.match(customerMenuItemDetailHostClass, /fixed inset-0/);
    assert.match(customerMenuItemDetailHostClass, /lg:items-center/);
    assert.match(customerMenuItemDetailPanelClass, /max-lg:h-full/);
    assert.match(customerMenuItemDetailPanelClass, /lg:max-w-lg/);
    assert.doesNotMatch(customerMenuItemDetailPanelClass, /68rem/);
  });

  it('hero uses shared 4:3 aspect from menu-image', () => {
    assert.match(CUSTOMER_MENU_ITEM_DETAIL_HERO_CLASS, /aspect-\[4\/3\]/);
    assert.match(CUSTOMER_MENU_ITEM_DETAIL_HERO_CLASS, new RegExp(MENU_IMAGE_ASPECT_CLASS.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.equal(MENU_IMAGE_OBJECT_FIT_CLASS, 'object-contain object-center');
    assert.doesNotMatch(MENU_IMAGE_OBJECT_FIT_CLASS, /object-cover/);
  });
});
