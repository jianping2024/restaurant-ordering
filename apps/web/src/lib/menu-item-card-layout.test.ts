import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CART_QTY_STEPPER_GAP_CLASS } from './cart-qty-stepper-layout';
import {
  CUSTOMER_MENU_ITEM_LIST_CLASS,
  CUSTOMER_MENU_ITEM_LIST_HOST_CLASS,
  MENU_ITEM_CARD_ACTION_SLOT_CLASS,
  MENU_ITEM_CARD_BODY_CLASS,
  MENU_ITEM_CARD_FLAVOR_SLOT_CLASS,
  MENU_ITEM_CARD_NAME_CLASS,
  MENU_ITEM_CARD_PRICE_ACTION_ROW_CLASS,
  MENU_ITEM_CARD_SHELL_CLASS,
  MENU_ITEM_CARD_THUMB_CLASS,
  MENU_ITEM_CARD_THUMB_PX,
} from './menu-item-card-layout';

describe('menuItemCardLayout', () => {
  it('locks body height to the square thumb and uses content-width foot', () => {
    assert.equal(MENU_ITEM_CARD_THUMB_PX, 112);
    assert.match(MENU_ITEM_CARD_THUMB_CLASS, /h-\[7rem\]/);
    assert.match(MENU_ITEM_CARD_BODY_CLASS, /h-\[7rem\]/);
    assert.match(MENU_ITEM_CARD_PRICE_ACTION_ROW_CLASS, /justify-between/);
    assert.doesNotMatch(MENU_ITEM_CARD_PRICE_ACTION_ROW_CLASS, /6\.75rem/);
    assert.equal(MENU_ITEM_CARD_ACTION_SLOT_CLASS, 'flex shrink-0 items-center justify-end');
  });

  it('shell keeps foot actions inside rounded face without overflow-hidden', () => {
    assert.equal(
      MENU_ITEM_CARD_SHELL_CLASS,
      'bg-brand-card border rounded-2xl p-4 flex min-w-0 gap-3 h-full',
    );
    assert.match(MENU_ITEM_CARD_SHELL_CLASS, /rounded-2xl/);
    assert.match(MENU_ITEM_CARD_SHELL_CLASS, /\bp-4\b/);
    assert.doesNotMatch(MENU_ITEM_CARD_SHELL_CLASS, /\bp-3\b/);
    assert.doesNotMatch(MENU_ITEM_CARD_SHELL_CLASS, /overflow-hidden/);
  });

  it('list CartQtyStepper compact gap is tighter than default; one gap map', () => {
    assert.equal(CART_QTY_STEPPER_GAP_CLASS.default, 'gap-2');
    assert.equal(CART_QTY_STEPPER_GAP_CLASS.compact, 'gap-1');
  });

  it('reserves name ≤2 lines and flavor ≤1 row; no list description token', () => {
    assert.match(MENU_ITEM_CARD_NAME_CLASS, /-webkit-line-clamp:2/);
    assert.match(MENU_ITEM_CARD_NAME_CLASS, /h-\[2\.4375rem\]/);
    assert.match(MENU_ITEM_CARD_FLAVOR_SLOT_CLASS, /h-\[1\.375rem\]/);
    assert.match(MENU_ITEM_CARD_FLAVOR_SLOT_CLASS, /flex-nowrap/);
    assert.match(MENU_ITEM_CARD_FLAVOR_SLOT_CLASS, /overflow-hidden/);
  });

  it('sole catalog list columns track host container width (not viewport xl)', () => {
    assert.equal(CUSTOMER_MENU_ITEM_LIST_HOST_CLASS, 'mesa-menu-catalog-host');
    assert.equal(CUSTOMER_MENU_ITEM_LIST_CLASS, 'mesa-menu-item-list');
    assert.doesNotMatch(CUSTOMER_MENU_ITEM_LIST_CLASS, /lg:grid-cols|xl:grid-cols/);
  });
});
