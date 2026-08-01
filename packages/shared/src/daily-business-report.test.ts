import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ANALYTICS_DAILY_SCHEMA_VERSION,
  parseDailyBusinessReport,
} from './daily-business-report';

describe('parseDailyBusinessReport', () => {
  it('accepts a valid sealed package', () => {
    const parsed = parseDailyBusinessReport({
      schemaVersion: ANALYTICS_DAILY_SCHEMA_VERSION,
      restaurantId: 'r1',
      businessDate: '2026-08-01',
      metrics: {
        revenue: 10,
        adultCount: 2,
        childCount: 0,
        customerCount: 2,
        qualifyingSessionCount: 1,
      },
      topItems: [
        {
          rank: 1,
          itemId: 'i1',
          namePt: 'A',
          nameEn: null,
          nameZh: null,
          consumedQuantity: 3,
          amount: 9,
        },
      ],
    });
    assert.ok(parsed);
    assert.equal(parsed?.topItems[0]?.itemId, 'i1');
  });

  it('rejects wrong schema version and bad rank', () => {
    assert.equal(
      parseDailyBusinessReport({
        schemaVersion: 1,
        restaurantId: 'r1',
        businessDate: '2026-08-01',
        metrics: {
          revenue: 0,
          adultCount: 0,
          childCount: 0,
          customerCount: 0,
          qualifyingSessionCount: 0,
        },
        topItems: [],
      }),
      null,
    );
    assert.equal(
      parseDailyBusinessReport({
        schemaVersion: ANALYTICS_DAILY_SCHEMA_VERSION,
        restaurantId: 'r1',
        businessDate: '2026-08-01',
        metrics: {
          revenue: 0,
          adultCount: 0,
          childCount: 0,
          customerCount: 0,
          qualifyingSessionCount: 0,
        },
        topItems: [
          {
            rank: 2,
            itemId: 'i1',
            namePt: 'A',
            nameEn: null,
            nameZh: null,
            consumedQuantity: 1,
            amount: 1,
          },
        ],
      }),
      null,
    );
  });
});
