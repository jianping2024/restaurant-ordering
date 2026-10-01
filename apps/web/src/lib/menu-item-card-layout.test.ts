import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CUSTOMER_MENU_ITEM_LIST_CLASS,
  MENU_ITEM_CARD_ACTION_SLOT_CLASS,
  MENU_ITEM_CARD_DESC_CLASS,
  MENU_ITEM_CARD_FLAVOR_SLOT_CLASS,
  MENU_ITEM_CARD_NAME_CLASS,
  MENU_ITEM_CARD_PRICE_ACTION_ROW_CLASS,
  MENU_ITEM_CARD_THUMB_CLASS,
} from './menu-item-card-layout';

describe('menuItemCardLayout', () => {
  it('price/action row is content-width flex (no empty stepper column)', () => {
    assert.match(MENU_ITEM_CARD_PRICE_ACTION_ROW_CLASS, /justify-between/);
    assert.doesNotMatch(MENU_ITEM_CARD_PRICE_ACTION_ROW_CLASS, /6\.75rem/);
    assert.equal(MENU_ITEM_CARD_ACTION_SLOT_CLASS, 'flex shrink-0 items-center justify-end');
  });

  it('reserves fixed slots for name, flavor band, and description', () => {
    assert.match(MENU_ITEM_CARD_NAME_CLASS, /-webkit-line-clamp:2/);
    assert.match(MENU_ITEM_CARD_NAME_CLASS, /h-\[2\.4375rem\]/);
    assert.match(MENU_ITEM_CARD_FLAVOR_SLOT_CLASS, /h-\[3\.0625rem\]/);
    assert.match(MENU_ITEM_CARD_FLAVOR_SLOT_CLASS, /overflow-hidden/);
    assert.match(MENU_ITEM_CARD_DESC_CLASS, /-webkit-line-clamp:2/);
    assert.match(MENU_ITEM_CARD_DESC_CLASS, /h-\[2\.1rem\]/);
    assert.match(MENU_ITEM_CARD_THUMB_CLASS, /h-\[5\.5rem\]/);
  });

  it('sole catalog list is 1 / lg:2 / xl:3 columns', () => {
    assert.equal(
      CUSTOMER_MENU_ITEM_LIST_CLASS,
      'grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3',
    );
  });
});
