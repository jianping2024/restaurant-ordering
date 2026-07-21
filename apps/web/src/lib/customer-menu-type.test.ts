import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CUSTOMER_MENU_TYPE } from './customer-menu-type';

describe('CUSTOMER_MENU_TYPE', () => {
  it('uses body-scale tokens for footer summary and money (no font-heading on body text)', () => {
    assert.match(CUSTOMER_MENU_TYPE.footerSummary, /text-base/);
    assert.match(CUSTOMER_MENU_TYPE.moneyAmount, /text-brand-gold/);
    assert.doesNotMatch(CUSTOMER_MENU_TYPE.footerSummary, /font-heading/);
    assert.doesNotMatch(CUSTOMER_MENU_TYPE.moneyAmount, /font-heading/);
  });

  it('keeps drawer chrome on heading font separately from menu body text', () => {
    assert.match(CUSTOMER_MENU_TYPE.drawerTitle, /font-heading/);
    assert.match(CUSTOMER_MENU_TYPE.cartDrawerTotal, /font-heading/);
  });

  it('avoids repeating category size on active state modifier', () => {
    assert.doesNotMatch(CUSTOMER_MENU_TYPE.categoryTopActive, /text-lg/);
    assert.match(CUSTOMER_MENU_TYPE.categoryTop, /text-lg/);
  });
});
