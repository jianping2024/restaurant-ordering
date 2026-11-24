import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import {
  clearMultiStoreKpiCache,
  multiStoreKpiCacheKey,
  MULTI_STORE_OVERVIEW_CACHE_TTL_MS,
  readMultiStoreKpiCache,
  type MultiStoreKpiSnapshot,
} from '@/lib/multi-store-overview-cache';

const snap = (tag: string): MultiStoreKpiSnapshot => ({
  todayDateKey: '2026-11-24',
  generatedAt: tag,
  kpisByRestaurantId: {},
});

describe('multi-store KPI cache', () => {
  beforeEach(() => clearMultiStoreKpiCache());

  it('keys by day + sorted id set', () => {
    assert.equal(multiStoreKpiCacheKey(['b', 'a'], 'd'), multiStoreKpiCacheKey(['a', 'b'], 'd'));
    assert.notEqual(multiStoreKpiCacheKey(['a'], 'd1'), multiStoreKpiCacheKey(['a'], 'd2'));
  });

  it('serves within TTL, reloads after', async () => {
    let calls = 0;
    const load = async () => snap(String(++calls));
    assert.equal((await readMultiStoreKpiCache(['a'], 'd', 0, load)).generatedAt, '1');
    assert.equal((await readMultiStoreKpiCache(['a'], 'd', MULTI_STORE_OVERVIEW_CACHE_TTL_MS - 1, load)).generatedAt, '1');
    assert.equal((await readMultiStoreKpiCache(['a'], 'd', MULTI_STORE_OVERVIEW_CACHE_TTL_MS, load)).generatedAt, '2');
    assert.equal((await readMultiStoreKpiCache(['a', 'b'], 'd', MULTI_STORE_OVERVIEW_CACHE_TTL_MS, load)).generatedAt, '3');
  });

  it('drops a failed load so the next call retries', async () => {
    await assert.rejects(readMultiStoreKpiCache(['a'], 'd', 0, async () => { throw new Error('x'); }));
    await new Promise((r) => setImmediate(r));
    assert.equal((await readMultiStoreKpiCache(['a'], 'd', 1, async () => snap('ok'))).generatedAt, 'ok');
  });
});
