import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildMenuCatalogBrowseRankByItemId } from '@/lib/menu-catalog-browse-rank';
import type { MenuCategory, MenuItem } from '@/types';

function cat(
  partial: Pick<MenuCategory, 'id' | 'sort_order'> &
    Partial<Pick<MenuCategory, 'parent_id' | 'active'>>,
): MenuCategory {
  return {
    restaurant_id: 'r1',
    name_pt: partial.id,
    created_at: '2026-01-01T00:00:00.000Z',
    active: partial.active ?? true,
    parent_id: partial.parent_id ?? null,
    ...partial,
  };
}

function item(
  partial: Pick<MenuItem, 'id' | 'sort_order'> &
    Partial<Pick<MenuItem, 'category_id' | 'created_at'>>,
): MenuItem {
  return {
    restaurant_id: 'r1',
    name_pt: partial.id,
    price: 1,
    vat_rate: 23,
    category: 'x',
    emoji: '',
    available: true,
    created_at: partial.created_at ?? '2026-01-01T00:00:00.000Z',
    category_id: partial.category_id ?? null,
    ...partial,
  };
}

describe('buildMenuCatalogBrowseRankByItemId', () => {
  it('orders by category tree then dish sort_order within category', () => {
    const categories = [
      cat({ id: 'drinks', sort_order: 2 }),
      cat({ id: 'cocktails', sort_order: 1 }),
      cat({ id: 'fruit', parent_id: 'drinks', sort_order: 1 }),
    ];
    const items = [
      item({ id: '106', category_id: 'cocktails', sort_order: 6 }),
      item({ id: '101', category_id: 'cocktails', sort_order: 1 }),
      item({ id: 'juice', category_id: 'fruit', sort_order: 1 }),
      item({ id: 'water', category_id: 'drinks', sort_order: 1 }),
    ];

    const rank = buildMenuCatalogBrowseRankByItemId(categories, items);
    assert.deepEqual(
      [...rank.entries()].sort((a, b) => a[1] - b[1]).map(([id]) => id),
      ['101', '106', 'water', 'juice'],
    );
  });
});
