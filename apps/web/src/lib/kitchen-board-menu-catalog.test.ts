import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  collectKitchenBoardMenuItemIds,
  kitchenBoardMenuCatalogFromRows,
  resolveKitchenBoardDishCatalogEntry,
} from './kitchen-board-menu-catalog';
import type { Order } from '@/types';

describe('kitchenBoardMenuCatalogFromRows', () => {
  it('maps thin rows and trims image_url', () => {
    const map = kitchenBoardMenuCatalogFromRows([
      {
        id: 'm1',
        image_url: '  https://example.com/a.jpg  ',
        emoji: '🍗',
        name_pt: 'Frango',
        name_zh: '烤鸡',
        allergen_codes: ['egg'],
        flavor_codes: ['spicy'],
        is_vegetarian: false,
      },
      { id: '  ', name_pt: 'skip' },
    ]);
    assert.equal(map.m1?.image_url, 'https://example.com/a.jpg');
    assert.equal(map.m1?.emoji, '🍗');
    assert.deepEqual(map.m1?.allergen_codes, ['egg']);
    assert.equal(Object.keys(map).length, 1);
  });
});

describe('resolveKitchenBoardDishCatalogEntry', () => {
  it('prefers catalog when present', () => {
    const entry = resolveKitchenBoardDishCatalogEntry({
      menuItemId: 'm1',
      catalogById: {
        m1: {
          id: 'm1',
          image_url: 'https://example.com/a.jpg',
          emoji: '🍗',
          name_pt: 'Frango',
          description_pt: 'Grelhado',
          allergen_codes: [],
          flavor_codes: [],
        },
      },
      orderItem: {
        emoji: '❌',
        name: 'Old',
        name_pt: 'Old',
      },
    });
    assert.equal(entry.image_url, 'https://example.com/a.jpg');
    assert.equal(entry.name_pt, 'Frango');
    assert.equal(entry.description_pt, 'Grelhado');
  });

  it('falls back to order snapshot without inventing description', () => {
    const entry = resolveKitchenBoardDishCatalogEntry({
      menuItemId: 'gone',
      catalogById: {},
      orderItem: {
        emoji: '🥚',
        name: 'Bras',
        name_pt: 'Bacalhau',
        name_zh: '碎蛋鳕鱼',
        item_code: '005',
      },
    });
    assert.equal(entry.image_url, null);
    assert.equal(entry.emoji, '🥚');
    assert.equal(entry.name_pt, 'Bacalhau');
    assert.equal(entry.name_zh, '碎蛋鳕鱼');
    assert.equal(entry.item_code, '005');
    assert.equal(entry.description_pt, undefined);
    assert.deepEqual(entry.allergen_codes, []);
  });
});

describe('collectKitchenBoardMenuItemIds', () => {
  it('skips buffet_base and empty ids', () => {
    const orders = [
      {
        id: 'o1',
        items: [
          { id: 'm1', kind: 'menu', emoji: 'a', name: 'A', name_pt: 'A', qty: 1, price: 1 },
          {
            id: 'buffet:x',
            kind: 'buffet_base',
            emoji: 'b',
            name: 'B',
            name_pt: 'B',
            qty: 1,
            price: 1,
          },
          { id: '  ', kind: 'menu', emoji: 'c', name: 'C', name_pt: 'C', qty: 1, price: 1 },
        ],
      },
    ] as Order[];
    assert.deepEqual(collectKitchenBoardMenuItemIds(orders), ['m1']);
  });
});
