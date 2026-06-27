import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  canReorderVisibleMenuItems,
  compareMenuItemsForDisplay,
  menuItemsShareSortScope,
} from './menu-item-order';
import type { MenuItem } from '@/types';

function item(partial: Partial<MenuItem> & Pick<MenuItem, 'id'>): MenuItem {
  return {
    restaurant_id: 'r1',
    name_pt: 'Item',
    price: 1,
    vat_rate: 23,
    category: 'Cat',
    emoji: '🍽️',
    available: true,
    sort_order: 0,
    created_at: '2026-01-01T00:00:00Z',
    ...partial,
  };
}

describe('canReorderVisibleMenuItems', () => {
  it('allows reorder when all visible dishes share one category', () => {
    const rows = [
      item({ id: 'a', category_id: 'c1', sort_order: 0 }),
      item({ id: 'b', category_id: 'c1', sort_order: 1 }),
    ];
    assert.equal(canReorderVisibleMenuItems(rows, ''), true);
  });

  it('allows reorder for uncategorized dishes', () => {
    const rows = [item({ id: 'a', category_id: null }), item({ id: 'b', category_id: undefined })];
    assert.equal(canReorderVisibleMenuItems(rows, ''), true);
  });

  it('disallows reorder when visible dishes span categories', () => {
    const rows = [
      item({ id: 'a', category_id: 'c1' }),
      item({ id: 'b', category_id: 'c2' }),
    ];
    assert.equal(canReorderVisibleMenuItems(rows, ''), false);
  });

  it('disallows reorder while search is active', () => {
    const rows = [item({ id: 'a', category_id: 'c1' })];
    assert.equal(canReorderVisibleMenuItems(rows, 'cola'), false);
  });
});

describe('menuItemsShareSortScope', () => {
  it('rejects different categories for server swap guard', () => {
    assert.equal(
      menuItemsShareSortScope({ category_id: 'c1' }, { category_id: 'c2' }),
      false,
    );
  });
});

describe('compareMenuItemsForDisplay', () => {
  it('sorts by sort_order then created_at', () => {
    const rows = [
      item({ id: 'b', sort_order: 1, created_at: '2026-01-02T00:00:00Z' }),
      item({ id: 'a', sort_order: 0, created_at: '2026-01-03T00:00:00Z' }),
      item({ id: 'c', sort_order: 1, created_at: '2026-01-01T00:00:00Z' }),
    ];
    assert.deepEqual(
      [...rows].sort(compareMenuItemsForDisplay).map((row) => row.id),
      ['a', 'c', 'b'],
    );
  });
});
