import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MENU_ITEM_CARD_ACTION_SLOT_CLASS,
  MENU_ITEM_CARD_PRICE_ACTION_ROW_CLASS,
} from './menu-item-card-layout';

describe('menuItemCardLayout', () => {
  it('uses a single fixed action column width for all card action states', () => {
    assert.match(MENU_ITEM_CARD_PRICE_ACTION_ROW_CLASS, /6\.75rem/);
    assert.match(MENU_ITEM_CARD_PRICE_ACTION_ROW_CLASS, /minmax\(0,1fr\)/);
    assert.equal(MENU_ITEM_CARD_ACTION_SLOT_CLASS, 'flex items-center justify-end');
  });
});
