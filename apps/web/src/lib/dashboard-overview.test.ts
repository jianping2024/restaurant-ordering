import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { BillSplit, Order } from '@/types';
import {
  buildFeedbackInsights,
  buildTodayTopSellingItems,
  buildTopSellingRows,
  computeTodayKpis,
  pendingActionsTotal,
} from '@/lib/dashboard-overview';

function order(partial: Partial<Order> & Pick<Order, 'id'>): Order {
  return {
    restaurant_id: 'r1',
    table_id: 't1',
    display_name: '1',
    status: 'done',
    items: [],
    total_amount: 0,
    created_at: '2026-06-27T12:00:00.000Z',
    updated_at: '2026-06-27T12:00:00.000Z',
    ...partial,
  };
}

describe('computeTodayKpis', () => {
  it('returns zero avg ticket when there are no orders', () => {
    const kpis = computeTodayKpis([]);
    assert.equal(kpis.todayOrderCount, 0);
    assert.equal(kpis.todayRevenue, 0);
    assert.equal(kpis.avgTicketPrice, 0);
  });

  it('computes average ticket from today revenue and count (legacy mode)', () => {
    const kpis = computeTodayKpis([
      order({ id: 'a', total_amount: 30 }),
      order({ id: 'b', total_amount: 50 }),
    ]);
    assert.equal(kpis.todayOrderCount, 2);
    assert.equal(kpis.todayRevenue, 80);
    assert.equal(kpis.avgTicketPrice, 40);
  });

  it('computes revenue from closed session with discount', () => {
    const orders = [order({ id: 'a', total_amount: 100, session_id: 's1' })];
    const sessions = [{ id: 's1', status: 'closed' }];
    const splits = [
      {
        session_id: 's1',
        status: 'requested',
        discount_rate: 10,
        result: [],
        total_amount: 100,
      },
    ];
    const kpis = computeTodayKpis(orders, sessions, splits);
    assert.equal(kpis.todayRevenue, 90);
  });

  it('excludes forced closed sessions', () => {
    const orders = [
      order({ id: 'a', total_amount: 100, session_id: 's1' }),
      order({ id: 'b', total_amount: 50, session_id: 's2' }),
    ];
    const sessions = [
      { id: 's1', status: 'closed' },
      { id: 's2', status: 'closed' },
    ];
    const splits: Array<Pick<BillSplit, 'session_id' | 'status' | 'discount_rate' | 'result' | 'total_amount'>> = [];
    const forcedClosedSessionIds = new Set(['s1']);
    const kpis = computeTodayKpis(orders, sessions, splits, forcedClosedSessionIds);
    assert.equal(kpis.todayRevenue, 50);
  });
});

describe('buildTodayTopSellingItems', () => {
  it('aggregates menu lines and excludes voided or buffet base rows', () => {
    const top = buildTodayTopSellingItems(
      [
        order({
          id: 'o1',
          items: [
            {
              id: 'd1',
              name: 'Cola',
              name_pt: 'Cola',
              qty: 2,
              price: 3,
              emoji: '🥤',
            },
            {
              id: 'd2',
              name: 'Voided',
              name_pt: 'Voided',
              qty: 1,
              price: 5,
              emoji: '🍽️',
              item_status: 'voided',
            },
            {
              id: 'buffet:1',
              kind: 'buffet_base',
              name: 'Buffet',
              name_pt: 'Buffet',
              qty: 1,
              price: 20,
              emoji: '🍽️',
              adult_count: 2,
            },
          ],
        }),
      ],
      'zh',
    );

    assert.equal(top.length, 1);
    assert.equal(top[0]?.name, 'Cola');
    assert.equal(top[0]?.count, 2);
    assert.equal(top[0]?.revenue, 6);
  });
});

describe('buildFeedbackInsights', () => {
  it('uses compact empty-state when billed sessions exist but no feedback samples', () => {
    const insights = buildFeedbackInsights(
      [],
      [{ session_id: 's1' }],
      [],
      'zh',
    );
    assert.equal(insights.hasSufficientData, false);
    assert.equal(insights.billedSessions, 1);
    assert.equal(insights.sessionsWithFeedback, 0);
  });

  it('shows full panel when feedback sessions exist', () => {
    const rows = [
      {
        menu_item_id: 'd1',
        vote: 'down',
        reasons: ['cold'],
        menu_items: { name_zh: '鱼', name_pt: 'Peixe', name_en: 'Fish' },
      },
    ];
    const sessions = [{ session_id: 's1', completed_at: '2026-06-27T12:00:00.000Z' }];
    const billed = [{ session_id: 's1' }];

    const insightsZh = buildFeedbackInsights(sessions, billed, rows, 'zh');
    const insightsEn = buildFeedbackInsights(sessions, billed, rows, 'en');

    assert.equal(insightsZh.hasSufficientData, true);
    assert.equal(insightsZh.topIssues.length, 1);
    assert.equal(insightsZh.topIssues[0]?.dish_name, '鱼');
    assert.equal(insightsEn.topIssues[0]?.dish_name, 'Fish');
    assert.equal(insightsZh.actionableRate, 1);
  });
});

describe('pendingActionsTotal', () => {
  it('sums all pending buckets', () => {
    assert.equal(
      pendingActionsTotal({
        inProgressOrders: 2,
        pendingCheckout: 1,
        pendingAbnormal: 0,
        pendingPrint: 3,
      }),
      6,
    );
  });
});

describe('buildTopSellingRows', () => {
  it('computes volume share for each ranked item', () => {
    const rows = buildTopSellingRows([
      { name: 'Cola', count: 3, revenue: 3 },
      { name: 'Juice', count: 2, revenue: 4 },
    ]);
    assert.equal(rows.length, 2);
    assert.equal(rows[0]?.rank, 1);
    assert.equal(rows[0]?.volumeShare, 0.6);
    assert.equal(rows[1]?.rank, 2);
    assert.equal(rows[1]?.volumeShare, 0.4);
  });
});
