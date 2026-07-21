import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  VALUE_OVERVIEW_REVALIDATE_SECONDS,
  valueOverviewBusinessDay,
  valueOverviewCacheKeyParts,
  valueOverviewCacheTag,
} from '@/lib/analytics/value-overview-cache-policy';

describe('value-overview-cache-policy', () => {
  it('partitions by Lisbon calendar day', () => {
    assert.equal(valueOverviewBusinessDay(new Date('2026-07-21T12:00:00.000Z')), '2026-07-21');
  });

  it('builds key parts for restaurant + range + business day', () => {
    const parts = valueOverviewCacheKeyParts(
      'restaurant-mohnrib5',
      '30d',
      new Date('2026-07-21T12:00:00.000Z'),
    );
    assert.deepEqual(parts, {
      restaurantId: 'restaurant-mohnrib5',
      range: '30d',
      businessDay: '2026-07-21',
    });
  });

  it('scopes cache tags per restaurant', () => {
    assert.equal(valueOverviewCacheTag('restaurant-mohnrib5'), 'value-overview:restaurant-mohnrib5');
  });

  it('uses a short TTL suitable for owner re-entry', () => {
    assert.equal(VALUE_OVERVIEW_REVALIDATE_SECONDS, 120);
  });
});
