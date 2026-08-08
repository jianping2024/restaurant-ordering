import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CUSTOMER_MENU_TYPE } from './customer-menu-type';

describe('CUSTOMER_MENU_TYPE', () => {
  it('keeps footer summary on body font; money uses mesa-money token (body face)', () => {
    assert.match(CUSTOMER_MENU_TYPE.footerSummary, /text-base/);
    assert.doesNotMatch(CUSTOMER_MENU_TYPE.footerSummary, /font-heading|mesa-money/);
    assert.match(CUSTOMER_MENU_TYPE.moneyAmount, /mesa-money/);
    assert.match(CUSTOMER_MENU_TYPE.moneyAmount, /text-\[15px\]/);
    assert.match(CUSTOMER_MENU_TYPE.moneyAmount, /text-brand-gold/);
  });

  it('keeps drawer title on heading utility; cart total uses mesa-money token', () => {
    assert.match(CUSTOMER_MENU_TYPE.drawerTitle, /font-heading/);
    assert.match(CUSTOMER_MENU_TYPE.cartDrawerTotal, /mesa-money/);
  });

  it('avoids repeating category size on active state modifier', () => {
    assert.doesNotMatch(CUSTOMER_MENU_TYPE.categoryTopActive, /text-lg/);
    assert.match(CUSTOMER_MENU_TYPE.categoryTop, /text-lg/);
  });
});
