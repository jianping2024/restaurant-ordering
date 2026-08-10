import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import {
  buildDashboardListCacheKey,
  clearDashboardListCache,
  dashboardListCacheSizeForTests,
  invalidateDashboardListCache,
  isDashboardListClosedRange,
  readDashboardListCache,
  writeDashboardListCache,
  DASHBOARD_LIST_OPEN_RANGE_MAX_AGE_MS,
} from './dashboard-list-query-cache';

describe('dashboard-list-query-cache', () => {
  beforeEach(() => {
    clearDashboardListCache();
  });

  it('treats endDate before today as closed', () => {
    assert.equal(isDashboardListClosedRange('2026-08-09', '2026-08-10'), true);
    assert.equal(isDashboardListClosedRange('2026-08-10', '2026-08-10'), false);
    assert.equal(isDashboardListClosedRange('2026-08-11', '2026-08-10'), false);
  });

  it('keeps closed-range entries fresh indefinitely', () => {
    const key = buildDashboardListCacheKey({
      scope: 'operation-logs',
      restaurantId: 'r1',
      filters: { startDate: '2026-08-01', endDate: '2026-08-09' },
      page: 1,
      pageSize: 20,
    });
    writeDashboardListCache(key, { items: [1] }, 1_000);
    const hit = readDashboardListCache<{ items: number[] }>(key, {
      closed: true,
      now: 1_000 + DASHBOARD_LIST_OPEN_RANGE_MAX_AGE_MS * 10,
    });
    assert.equal(hit.action, 'fresh');
    if (hit.action === 'fresh') assert.deepEqual(hit.data, { items: [1] });
  });

  it('marks open-range entries stale after TTL', () => {
    const key = buildDashboardListCacheKey({
      scope: 'operation-logs',
      restaurantId: 'r1',
      filters: { startDate: '2026-08-10', endDate: '2026-08-10' },
      page: 1,
      pageSize: 20,
    });
    writeDashboardListCache(key, { items: [2] }, 1_000);
    const fresh = readDashboardListCache(key, {
      closed: false,
      now: 1_000 + 1_000,
    });
    assert.equal(fresh.action, 'fresh');

    const stale = readDashboardListCache(key, {
      closed: false,
      now: 1_000 + DASHBOARD_LIST_OPEN_RANGE_MAX_AGE_MS + 1,
    });
    assert.equal(stale.action, 'stale');
    if (stale.action === 'stale') assert.deepEqual(stale.data, { items: [2] });
  });

  it('invalidates only the matching scope + restaurant', () => {
    const a = buildDashboardListCacheKey({
      scope: 'abnormal-operations',
      restaurantId: 'r1',
      filters: { endDate: '2026-08-09' },
      page: 1,
      pageSize: 20,
    });
    const b = buildDashboardListCacheKey({
      scope: 'abnormal-operations',
      restaurantId: 'r2',
      filters: { endDate: '2026-08-09' },
      page: 1,
      pageSize: 20,
    });
    const c = buildDashboardListCacheKey({
      scope: 'operation-logs',
      restaurantId: 'r1',
      filters: { endDate: '2026-08-09' },
      page: 1,
      pageSize: 20,
    });
    writeDashboardListCache(a, 'a');
    writeDashboardListCache(b, 'b');
    writeDashboardListCache(c, 'c');
    invalidateDashboardListCache('abnormal-operations', 'r1');
    assert.equal(readDashboardListCache(a, { closed: true }).action, 'miss');
    assert.equal(readDashboardListCache(b, { closed: true }).action, 'fresh');
    assert.equal(readDashboardListCache(c, { closed: true }).action, 'fresh');
    assert.equal(dashboardListCacheSizeForTests(), 2);
  });

  it('evicts oldest entries past max size', () => {
    for (let i = 0; i < 45; i += 1) {
      writeDashboardListCache(
        buildDashboardListCacheKey({
          scope: 'operation-logs',
          restaurantId: 'r1',
          filters: { i },
          page: 1,
          pageSize: 20,
        }),
        i,
        i,
      );
    }
    assert.equal(dashboardListCacheSizeForTests(), 40);
    const first = buildDashboardListCacheKey({
      scope: 'operation-logs',
      restaurantId: 'r1',
      filters: { i: 0 },
      page: 1,
      pageSize: 20,
    });
    assert.equal(readDashboardListCache(first, { closed: true }).action, 'miss');
  });
});
