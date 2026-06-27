import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  canReorderMenuItemsInFilter,
  compareMenuItemsBySortOrder,
  menuItemsShareSortScope,
} from './menu-admin';
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

describe('canReorderMenuItemsInFilter', () => {
  it('allows reorder for a specific category without search', () => {
    assert.equal(canReorderMenuItemsInFilter('cat:uuid-1', ''), true);
  });

  it('allows reorder for uncategorized without search', () => {
    assert.equal(canReorderMenuItemsInFilter('uncategorized', ''), true);
  });

  it('disallows reorder for all-menu or top-level aggregate views', () => {
    assert.equal(canReorderMenuItemsInFilter('all:menu', ''), false);
    assert.equal(canReorderMenuItemsInFilter('top:uuid-1', ''), false);
  });

  it('disallows reorder while search is active', () => {
    assert.equal(canReorderMenuItemsInFilter('cat:uuid-1', 'cola'), false);
  });
});

describe('menuItemsShareSortScope', () => {
  it('treats matching category ids as same scope', () => {
    assert.equal(
      menuItemsShareSortScope({ category_id: 'c1' }, { category_id: 'c1' }),
      true,
    );
  });

  it('treats null/undefined category as uncategorized scope', () => {
    assert.equal(menuItemsShareSortScope({ category_id: null }, { category_id: undefined }), true);
  });

  it('rejects different categories', () => {
    assert.equal(
      menuItemsShareSortScope({ category_id: 'c1' }, { category_id: 'c2' }),
      false,
    );
  });
});

describe('compareMenuItemsBySortOrder', () => {
  it('sorts by sort_order then created_at', () => {
    const rows = [
      item({ id: 'b', sort_order: 1, created_at: '2026-01-02T00:00:00Z' }),
      item({ id: 'a', sort_order: 0, created_at: '2026-01-03T00:00:00Z' }),
      item({ id: 'c', sort_order: 1, created_at: '2026-01-01T00:00:00Z' }),
    ];
    assert.deepEqual(
      [...rows].sort(compareMenuItemsBySortOrder).map((row) => row.id),
      ['a', 'c', 'b'],
    );
  });
});
