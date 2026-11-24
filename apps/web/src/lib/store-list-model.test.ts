import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AuthorizedRestaurant } from '@/lib/permissions/restaurant-access-rules';
import {
  buildStoreListGroups,
  nextRecentStoreIds,
} from '@/lib/store-list-model';
import { formatLastRestaurantCookie, parseLastRestaurantCookie } from '@/lib/last-restaurant-cookie';

function s(id: string, name: string, city: string, over: Partial<AuthorizedRestaurant> = {}): AuthorizedRestaurant {
  return {
    id,
    slug: `slug-${id}`,
    suspended_at: null,
    access: 'staff',
    name,
    city,
    roleName: 'Gerente',
    favoritedAt: null,
    landingPath: `/dashboard/r/slug-${id}`,
    ...over,
  };
}

describe('buildStoreListGroups', () => {
  const stores = [
    s('1', 'Casa Porto', 'Porto'),
    s('2', 'Sushi Évora', 'Évora', { favoritedAt: '2026-11-02T00:00:00Z' }),
    s('3', 'Baiyun Lisboa', 'Lisboa', { favoritedAt: '2026-11-01T00:00:00Z' }),
    s('4', 'Mar', ''),
  ];

  it('favorites (oldest first) → recent (not favorited, ≤5) → all by city', () => {
    const groups = buildStoreListGroups(stores, { query: '', recentIds: ['3', '1', 'gone'] });
    assert.deepEqual(
      groups.map((g) => [g.kind, g.items.map((x) => x.id)]),
      [
        ['favorites', ['3', '2']],
        ['recent', ['1']],
        ['all', ['2', '3', '1', '4']],
      ],
    );
  });

  it('query: one results group, accent/case-insensitive on name and city', () => {
    const groups = buildStoreListGroups(stores, { query: 'evora', recentIds: [] });
    assert.deepEqual(groups.map((g) => [g.kind, g.items.map((x) => x.id)]), [['results', ['2']]]);
    assert.deepEqual(
      buildStoreListGroups(stores, { query: 'PORTO', recentIds: [] })[0].items.map((x) => x.id),
      ['1'],
    );
  });

  it('recent list moves entered store to front, capped at 5', () => {
    assert.deepEqual(nextRecentStoreIds(['a', 'b', 'c', 'd', 'e'], 'c'), ['c', 'a', 'b', 'd', 'e']);
    assert.deepEqual(nextRecentStoreIds(['a', 'b', 'c', 'd', 'e'], 'f'), ['f', 'a', 'b', 'c', 'd']);
  });
});

describe('last restaurant cookie', () => {
  it('round-trips only for the same account', () => {
    const v = formatLastRestaurantCookie('u1', 'r1');
    assert.equal(parseLastRestaurantCookie(v, 'u1'), 'r1');
    assert.equal(parseLastRestaurantCookie(v, 'u2'), null);
    assert.equal(parseLastRestaurantCookie('garbage', 'u1'), null);
    assert.equal(parseLastRestaurantCookie(undefined, 'u1'), null);
  });
});
