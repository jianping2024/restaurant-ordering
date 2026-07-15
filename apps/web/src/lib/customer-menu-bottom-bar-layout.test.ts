import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  customerMenuPageBottomPaddingClass,
  CUSTOMER_MENU_BOTTOM_BAR_HEIGHT_CLASS,
} from './customer-menu-bottom-bar-layout';

describe('customerMenuPageBottomPaddingClass', () => {
  it('reserves bar height + safe area when footer is visible', () => {
    const cls = customerMenuPageBottomPaddingClass(true);
    assert.match(cls, /3\.5rem/);
    assert.match(cls, /safe-area-inset-bottom/);
    assert.equal(CUSTOMER_MENU_BOTTOM_BAR_HEIGHT_CLASS, 'h-14');
  });

  it('uses lighter padding when footer is hidden', () => {
    assert.equal(customerMenuPageBottomPaddingClass(false), 'pb-16');
  });
});
