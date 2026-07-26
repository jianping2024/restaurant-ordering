import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { aggregateMenuItemsFromOrders, rankMenuItemAggs } from '@/lib/analytics/aggregate-items';
import { buildRevenueTrend } from '@/lib/analytics/build-overview';
import { resolveAnalyticsDateWindow, resolveTodayLisbonWindow } from '@/lib/analytics/date-window';
import { getValueOverview } from '@/lib/analytics/analytics.service';
import { trendsFromDailyRows } from '@/lib/analytics/daily-stats';
import { isQualifyingSession, sessionGuestCounts, sessionRevenue } from '@/lib/analytics/qualifying';
import { parseAnalyticsRange } from '@/lib/analytics/date-window';
import { ANALYTICS_DAILY_SCHEMA_VERSION } from '@/lib/analytics/analytics.types';
import type { BillSplit, Order, OrderItem } from '@/types';

const FIXED_NOW = new Date('2026-06-26T12:00:00.000Z');

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
  it('accepts 7d default and 30d', () => {
    assert.equal(parseAnalyticsRange(null), '7d');
    assert.equal(parseAnalyticsRange('7d'), '7d');
    assert.equal(parseAnalyticsRange('30d'), '30d');
    assert.equal(parseAnalyticsRange('90d'), null);
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
  it('builds 7 date keys for 7d', () => {
    const window = resolveAnalyticsDateWindow('7d', FIXED_NOW);
    assert.equal(window.dateKeys.length, 7);
    assert.equal(window.range, '7d');
  });

  it('builds 30 date keys for 30d', () => {
    const window = resolveAnalyticsDateWindow('30d', FIXED_NOW);
    assert.equal(window.dateKeys.length, 30);
  });
});

describe('isQualifyingSession', () => {
  it('excludes unpaid force close (zero total, no paid split)', () => {
    assert.equal(isQualifyingSession([{ total_amount: 0 }], [{ status: 'cancelled' }]), false);
  });

  it('includes paid split sessions', () => {
    assert.equal(isQualifyingSession([], [{ status: 'paid' }]), true);
  });

  it('includes positive order total without split', () => {
    assert.equal(isQualifyingSession([{ total_amount: 42 }], []), true);
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

  it('applies discount to paid split rows', () => {
    const splits: BillSplit[] = [
      {
        id: 's1',
        restaurant_id: 'r',
        table_id: 't',
        display_name: '1',
        order_ids: [],
        split_mode: 'even',
        persons: [],
        result: [{ name: 'A', amount: 100, paid: true }],
        total_amount: 100,
        status: 'paid',
        created_at: '',
        discount_rate: 10,
      } as BillSplit,
    ];
    assert.equal(sessionRevenue([], splits), 90);
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
    assert.equal(map.get('cola')?.amount, 4);
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

describe('trendsFromDailyRows', () => {
  it('uses sealed rows and today live; missing days are zero', () => {
    const { revenueTrend, customerTrend } = trendsFromDailyRows(
      ['2026-06-24', '2026-06-25', '2026-06-26'],
      [
        {
          restaurant_id: 'r',
          business_date: '2026-06-24',
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
        businessDate: '2026-06-26',
        revenue: 40,
        adultCount: 3,
        childCount: 1,
        customerCount: 4,
        qualifyingSessionCount: 2,
      },
      '2026-06-26',
    );
    assert.deepEqual(revenueTrend, [
      { date: '2026-06-24', revenue: 10 },
      { date: '2026-06-25', revenue: 0 },
      { date: '2026-06-26', revenue: 40 },
    ]);
    assert.equal(customerTrend[1]?.customerCount, 0);
    assert.equal(customerTrend[2]?.customerCount, 4);
  });
});

describe('getValueOverview with mock admin', () => {
  it('returns empty trends when no sessions or sealed rows', async () => {
    const result = await getValueOverview(mockEmptyAdmin() as never, 'restaurant-1', '7d', FIXED_NOW);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.data.schemaVersion, ANALYTICS_DAILY_SCHEMA_VERSION);
    assert.equal(result.data.revenueTrend.length, 7);
    assert.equal(result.data.customerTrend.length, 7);
    assert.ok(!('topConsumedItems' in result.data));
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
