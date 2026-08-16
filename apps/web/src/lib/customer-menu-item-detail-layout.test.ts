import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CUSTOMER_MENU_ITEM_DETAIL_HERO_CLASS,
  customerMenuItemDetailHostClass,
  customerMenuItemDetailPanelClass,
} from './customer-menu-item-detail-layout';

describe('customerMenuItemDetailLayout', () => {
  it('hosts phone fullscreen stretch and lg centered dialog', () => {
    assert.match(customerMenuItemDetailHostClass, /fixed inset-0/);
    assert.match(customerMenuItemDetailHostClass, /lg:items-center/);
    assert.match(customerMenuItemDetailPanelClass, /max-lg:h-full/);
    assert.match(customerMenuItemDetailPanelClass, /lg:max-w-lg/);
    assert.doesNotMatch(customerMenuItemDetailPanelClass, /68rem/);
  });

  it('hero uses fixed 4:3 aspect', () => {
    assert.match(CUSTOMER_MENU_ITEM_DETAIL_HERO_CLASS, /aspect-\[4\/3\]/);
  });
});
