import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { MenuCategory } from '@/types';
import {
  categorySiblingDroppableId,
  menuCategorySiblingsInScope,
  parseCategorySiblingDroppableId,
} from './menu-category-order.ts';

function cat(
  partial: Pick<MenuCategory, 'id' | 'parent_id' | 'sort_order'> &
    Partial<Pick<MenuCategory, 'active'>>,
): MenuCategory {
  return {
    id: partial.id,
    restaurant_id: 'r1',
    parent_id: partial.parent_id,
    name_pt: partial.id,
    name_en: null,
    name_zh: null,
    sort_order: partial.sort_order,
    active: partial.active ?? true,
    created_at: '2026-01-01T00:00:00Z',
    print_station_id: null,
    item_code: 'A',
  };
}

describe('categorySiblingDroppableId', () => {
  it('round-trips root and nested parent ids', () => {
    assert.equal(categorySiblingDroppableId(null), 'menu-cat-siblings:root');
    assert.equal(parseCategorySiblingDroppableId('menu-cat-siblings:root'), null);
    const nested = categorySiblingDroppableId('parent-uuid');
    assert.equal(nested, 'menu-cat-siblings:parent-uuid');
    assert.equal(parseCategorySiblingDroppableId(nested), 'parent-uuid');
  });

  it('rejects unrelated droppable ids', () => {
    assert.equal(parseCategorySiblingDroppableId('menu-dish-reorder'), undefined);
  });
});

describe('menuCategorySiblingsInScope', () => {
  const rows = [
    cat({ id: 'a', parent_id: null, sort_order: 1 }),
    cat({ id: 'b', parent_id: null, sort_order: 0 }),
    cat({ id: 'c', parent_id: 'a', sort_order: 0 }),
    cat({ id: 'd', parent_id: 'a', sort_order: 2, active: false }),
    cat({ id: 'e', parent_id: 'a', sort_order: 1 }),
  ];

  it('returns active root siblings ordered by sort_order', () => {
    assert.deepEqual(
      menuCategorySiblingsInScope(rows, null).map((r) => r.id),
      ['b', 'a'],
    );
  });

  it('returns active children under parent and ignores inactive', () => {
    assert.deepEqual(
      menuCategorySiblingsInScope(rows, 'a').map((r) => r.id),
      ['c', 'e'],
    );
  });
});
