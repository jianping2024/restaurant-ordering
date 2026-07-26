import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { aggregateMenuItemsFromOrders, rankMenuItemAggs } from '@/lib/analytics/aggregate-items';
import { buildRevenueTrend } from '@/lib/analytics/build-overview';
import { resolveAnalyticsDateWindow, resolveTodayLisbonWindow } from '@/lib/analytics/date-window';
import { getValueOverview } from '@/lib/analytics/analytics.service';
import { buildGrainTrends } from '@/lib/analytics/daily-stats';
import {
  aggregateDailyPointsByGrain,
  hasBusinessActivity,
  isValueOverviewEmpty,
  periodKeyForDay,
  trimLeadingEmptyPeriods,
} from '@/lib/analytics/period-aggregate';
import { isQualifyingSession, sessionGuestCounts, sessionRevenue } from '@/lib/analytics/qualifying';
import { parseAnalyticsRange } from '@/lib/analytics/date-window';
import { ANALYTICS_DAILY_SCHEMA_VERSION } from '@/lib/analytics/analytics.types';
import type { BillSplit, Order, OrderItem } from '@/types';

const FIXED_NOW = new Date('2026-07-26T12:00:00.000Z');

function menuItem(partial: Partial<OrderItem> & { id: string; qty: number }): OrderItem {
  return {
    name: partial.name_pt || 'Item',
    name_pt: partial.name_pt || 'Item',
    price: partial.price ?? 10,
    emoji: '🍽',
    ...partial,
  };
}

function mockEmptyAdmin() {
  const result = { data: [] as unknown[], error: null };
  const builder: Record<string, unknown> = {};
  const self = () => builder;
  for (const key of [
    'select',
    'eq',
    'not',
    'gte',
    'lte',
    'lt',
    'in',
    'order',
    'range',
    'upsert',
  ]) {
    builder[key] = self;
  }
  (builder as { then: typeof Promise.resolve }).then = (
    onfulfilled: (value: typeof result) => unknown,
    onrejected?: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(onfulfilled, onrejected);
  return {
    from() {
      return builder;
    },
  };
}

describe('parseAnalyticsRange', () => {
  it('accepts day/week/month/quarter and maps legacy 7d/30d', () => {
    assert.equal(parseAnalyticsRange(null), 'day');
    assert.equal(parseAnalyticsRange('day'), 'day');
    assert.equal(parseAnalyticsRange('week'), 'week');
    assert.equal(parseAnalyticsRange('month'), 'month');
    assert.equal(parseAnalyticsRange('quarter'), 'quarter');
    assert.equal(parseAnalyticsRange('7d'), 'day');
    assert.equal(parseAnalyticsRange('30d'), 'day');
    assert.equal(parseAnalyticsRange('year'), null);
  });
});

describe('resolveTodayLisbonWindow', () => {
  it('returns utc bounds for the Lisbon calendar day', () => {
    const window = resolveTodayLisbonWindow(new Date('2026-07-21T12:00:00.000Z'));
    assert.equal(window.today, '2026-07-21');
    assert.ok(window.startUtc < window.endExclusiveUtc);
  });
});

describe('resolveAnalyticsDateWindow', () => {
  it('builds 30 date keys for day grain', () => {
    const window = resolveAnalyticsDateWindow('day', FIXED_NOW);
    assert.equal(window.dateKeys.length, 30);
    assert.equal(window.range, 'day');
  });

  it('starts week/month/quarter windows at Lisbon year start', () => {
    const week = resolveAnalyticsDateWindow('week', FIXED_NOW);
    assert.equal(week.startDate, '2026-01-01');
    assert.equal(week.endDate, '2026-07-26');
    const month = resolveAnalyticsDateWindow('month', FIXED_NOW);
    assert.equal(month.startDate, '2026-01-01');
  });
});

describe('period aggregate', () => {
  it('maps days to ISO week / month / quarter keys', () => {
    assert.equal(periodKeyForDay('2026-07-15', 'day'), '2026-07-15');
    assert.match(periodKeyForDay('2026-07-15', 'week'), /^2026-W\d{2}$/);
    assert.equal(periodKeyForDay('2026-07-15', 'month'), '2026-07');
    assert.equal(periodKeyForDay('2026-07-15', 'quarter'), '2026-Q3');
  });

  it('trims leading empty periods for week grain only', () => {
    const points = [
      { date: '2026-W01', revenue: 0, adultCount: 0, childCount: 0, customerCount: 0 },
      { date: '2026-W29', revenue: 10, adultCount: 1, childCount: 0, customerCount: 1 },
    ];
    const trimmed = trimLeadingEmptyPeriods(points, 'week');
    assert.equal(trimmed.length, 1);
    assert.equal(trimmed[0]?.date, '2026-W29');
    assert.equal(trimLeadingEmptyPeriods(points, 'day').length, 2);
  });

  it('aggregates daily points into months', () => {
    const agg = aggregateDailyPointsByGrain(
      [
        {
          date: '2026-07-15',
          revenue: 10,
          adultCount: 1,
          childCount: 0,
          customerCount: 1,
        },
        {
          date: '2026-07-16',
          revenue: 5,
          adultCount: 2,
          childCount: 0,
          customerCount: 2,
        },
      ],
      'month',
    );
    assert.equal(agg.length, 1);
    assert.equal(agg[0]?.date, '2026-07');
    assert.equal(agg[0]?.revenue, 15);
    assert.equal(agg[0]?.customerCount, 3);
  });

  it('detects business activity', () => {
    assert.equal(hasBusinessActivity({ revenue: 0, customerCount: 0 }), false);
    assert.equal(hasBusinessActivity({ revenue: 1, customerCount: 0 }), true);
    assert.equal(hasBusinessActivity({ revenue: 0, customerCount: 2 }), true);
    assert.equal(
      isValueOverviewEmpty({
        revenueTrend: [{ date: 'a', revenue: 0 }],
        customerTrend: [{ date: 'a', customerCount: 0, adultCount: 0, childCount: 0 }],
      }),
      true,
    );
    assert.equal(
      isValueOverviewEmpty({
        revenueTrend: [{ date: 'a', revenue: 1 }],
        customerTrend: [{ date: 'a', customerCount: 0, adultCount: 0, childCount: 0 }],
      }),
      false,
    );
  });
});

describe('buildGrainTrends', () => {
  it('fills missing day keys with zero for day grain', () => {
    const { revenueTrend } = buildGrainTrends(
      'day',
      ['2026-07-24', '2026-07-25', '2026-07-26'],
      [
        {
          restaurant_id: 'r',
          business_date: '2026-07-25',
          revenue: 10,
          adult_count: 1,
          child_count: 0,
          customer_count: 1,
          qualifying_session_count: 1,
          sealed_at: '',
          computed_at: '',
        },
      ],
      {
        businessDate: '2026-07-26',
        revenue: 3,
        adultCount: 1,
        childCount: 0,
        customerCount: 1,
        qualifyingSessionCount: 1,
      },
      '2026-07-26',
    );
    assert.deepEqual(revenueTrend, [
      { date: '2026-07-24', revenue: 0 },
      { date: '2026-07-25', revenue: 10 },
      { date: '2026-07-26', revenue: 3 },
    ]);
  });
});

describe('isQualifyingSession', () => {
  it('excludes unpaid force close (zero total, no paid split)', () => {
    assert.equal(isQualifyingSession([{ total_amount: 0 }], [{ status: 'cancelled' }]), false);
  });

  it('includes paid split sessions', () => {
    assert.equal(isQualifyingSession([], [{ status: 'paid' }]), true);
  });
});

describe('sessionRevenue', () => {
  it('sums paid split rows without discount', () => {
    const splits: BillSplit[] = [
      {
        id: 's1',
        restaurant_id: 'r',
        table_id: 't',
        display_name: '1',
        order_ids: [],
        split_mode: 'even',
        persons: [],
        result: [
          { name: 'A', amount: 45, paid: true },
          { name: 'B', amount: 5, paid: true },
        ],
        total_amount: 50,
        status: 'paid',
        created_at: '',
        discount_rate: 0,
      } as BillSplit,
    ];
    assert.equal(sessionRevenue([], splits), 50);
  });
});

describe('sessionGuestCounts', () => {
  it('sums latest active buffet lines', () => {
    const orders: Order[] = [
      {
        id: 'o1',
        restaurant_id: 'r',
        table_id: 't',
        display_name: '1',
        status: 'done',
        total_amount: 20,
        created_at: '',
        updated_at: '',
        items: [
          menuItem({
            id: 'b1',
            kind: 'buffet_base',
            buffet_id: 'bf',
            qty: 1,
            adult_count: 2,
            child_count: 1,
            added_at: '2026-01-01T10:00:00.000Z',
          }),
        ],
      },
    ];
    assert.deepEqual(sessionGuestCounts(orders), { adults: 2, children: 1 });
  });
});

describe('aggregateMenuItemsFromOrders', () => {
  it('excludes buffet_base and voided lines', () => {
    const orders: Order[] = [
      {
        id: 'o1',
        restaurant_id: 'r',
        table_id: 't',
        display_name: '1',
        status: 'done',
        total_amount: 20,
        created_at: '',
        updated_at: '',
        items: [
          menuItem({ id: 'cola', name_pt: 'Cola', qty: 2, price: 2 }),
          menuItem({ id: 'b', kind: 'buffet_base', name_pt: 'Buffet', qty: 1, price: 20 }),
          menuItem({ id: 'void', name_pt: 'Void', qty: 1, price: 5, item_status: 'voided' }),
        ],
      },
    ];
    const map = aggregateMenuItemsFromOrders(orders);
    assert.equal(map.size, 1);
    assert.equal(map.get('cola')?.consumedQuantity, 2);
  });
});

describe('buildRevenueTrend', () => {
  it('fills missing days with zero', () => {
    const dateKeys = ['2026-06-24', '2026-06-25', '2026-06-26'];
    const trend = buildRevenueTrend(
      dateKeys,
      [{ id: 'sess1', closed_at: '2026-06-25T22:00:00.000Z' }],
      new Map([
        [
          'sess1',
          [
            {
              id: 'o1',
              restaurant_id: 'r',
              table_id: 't',
              display_name: '1',
              status: 'done',
              total_amount: 10,
              created_at: '',
              updated_at: '',
              items: [],
              session_id: 'sess1',
            },
          ],
        ],
      ]),
      new Map(),
    );
    assert.deepEqual(trend, [
      { date: '2026-06-24', revenue: 0 },
      { date: '2026-06-25', revenue: 10 },
      { date: '2026-06-26', revenue: 0 },
    ]);
  });
});

describe('getValueOverview with mock admin', () => {
  it('returns empty trends when no sessions or sealed rows', async () => {
    const result = await getValueOverview(mockEmptyAdmin() as never, 'restaurant-1', 'day', FIXED_NOW);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.data.schemaVersion, ANALYTICS_DAILY_SCHEMA_VERSION);
    assert.equal(result.data.range, 'day');
  });
});

describe('rankMenuItemAggs', () => {
  it('sorts by quantity then amount', () => {
    const ranked = rankMenuItemAggs(
      new Map([
        ['a', { itemId: 'a', namePt: 'A', consumedQuantity: 5, amount: 10 }],
        ['b', { itemId: 'b', namePt: 'B', consumedQuantity: 10, amount: 5 }],
      ]),
      10,
    );
    assert.equal(ranked[0]?.itemId, 'b');
  });
});
