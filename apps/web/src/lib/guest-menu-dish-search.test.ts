import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { MenuItem } from '@/types';
import {
  buildGuestMenuDishSearchCandidates,
  matchGuestMenuDishSearch,
  type GuestMenuDishSearchCandidate,
} from './guest-menu-dish-search.ts';

const dish = (
  row: Partial<MenuItem> & Pick<MenuItem, 'id' | 'name_pt' | 'available'>,
): MenuItem => ({
  restaurant_id: 'r1',
  price: 10,
  vat_rate: 23,
  category: 'Pratos',
  category_id: 'c1',
  emoji: '🍽️',
  sort_order: 0,
  created_at: '',
  ...row,
});

function candidate(
  item: MenuItem,
  topCategoryId = 'c-mains',
  topCategoryLabel = '热菜',
): GuestMenuDishSearchCandidate {
  return { id: item.id, item, topCategoryId, topCategoryLabel };
}

describe('buildGuestMenuDishSearchCandidates', () => {
  it('keeps available nav dishes and drops sold-out / unmapped', () => {
    const a = dish({ id: 'a', name_pt: 'A', available: true, item_code: 'A01' });
    const b = dish({ id: 'b', name_pt: 'B', available: false, item_code: 'A02' });
    const c = dish({ id: 'c', name_pt: 'C', available: true, item_code: 'A03' });
    const map = new Map([
      ['a', 'c-mains'],
      ['b', 'c-mains'],
    ]);
    const rows = buildGuestMenuDishSearchCandidates({
      servedItems: [a, b, c],
      topCategoryIdByItemId: map,
      topCategories: [
        {
          id: 'c-mains',
          restaurant_id: 'r1',
          parent_id: null,
          name_pt: 'Pratos',
          name_zh: '热菜',
          sort_order: 1,
          active: true,
          created_at: '',
        },
      ],
      lang: 'zh',
      labelForCategory: (cat) => cat.name_zh || cat.name_pt,
    });
    assert.deepEqual(
      rows.map((r) => r.id),
      ['a'],
    );
    assert.equal(rows[0]?.topCategoryLabel, '热菜');
  });
});

describe('matchGuestMenuDishSearch', () => {
  const a01 = candidate(
    dish({ id: '1', name_pt: 'Pato', name_zh: '焗鸭饭', available: true, item_code: 'A01' }),
  );
  const a12 = candidate(
    dish({ id: '2', name_pt: 'Bife', name_zh: '黑椒牛柳', available: true, item_code: 'A12' }),
  );
  const soup = candidate(
    dish({ id: '3', name_pt: 'Sopa', name_zh: '酸辣汤', available: true, item_code: 'B01' }),
  );

  it('returns empty for blank query', () => {
    assert.deepEqual(matchGuestMenuDishSearch('  ', [a01, a12], 'zh'), []);
  });

  it('ranks exact code above prefix and name', () => {
    const hits = matchGuestMenuDishSearch('A01', [a12, a01, soup], 'zh');
    assert.deepEqual(
      hits.map((h) => h.id),
      ['1'],
    );
  });

  it('matches code prefix case-insensitively', () => {
    const hits = matchGuestMenuDishSearch('a1', [a01, a12, soup], 'zh');
    assert.deepEqual(
      hits.map((h) => h.id),
      ['2'],
    );
    const hitsA0 = matchGuestMenuDishSearch('A0', [a01, a12, soup], 'zh');
    assert.deepEqual(
      hitsA0.map((h) => h.id),
      ['1'],
    );
  });

  it('matches localized name contains', () => {
    const hits = matchGuestMenuDishSearch('牛柳', [a01, a12, soup], 'zh');
    assert.deepEqual(
      hits.map((h) => h.id),
      ['2'],
    );
  });
});
