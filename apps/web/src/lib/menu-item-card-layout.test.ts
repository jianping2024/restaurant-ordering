import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CUSTOMER_MENU_ITEM_LIST_CLASS,
  MENU_ITEM_CARD_ACTION_SLOT_CLASS,
  MENU_ITEM_CARD_PRICE_ACTION_ROW_CLASS,
} from './menu-item-card-layout';

describe('menuItemCardLayout', () => {
  it('uses a single fixed action column width for all card action states', () => {
    assert.match(MENU_ITEM_CARD_PRICE_ACTION_ROW_CLASS, /6\.75rem/);
    assert.match(MENU_ITEM_CARD_PRICE_ACTION_ROW_CLASS, /minmax\(0,1fr\)/);
    assert.equal(MENU_ITEM_CARD_ACTION_SLOT_CLASS, 'flex items-center justify-end');
  });

  it('sole catalog list is 1 / lg:2 / xl:3 columns', () => {
    assert.equal(
      CUSTOMER_MENU_ITEM_LIST_CLASS,
      'grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3',
    );
  });
});
