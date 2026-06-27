import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Order } from '@/types';
import {
  buildFeedbackInsights,
  buildTodayTopSellingItems,
  buildTopSellingRows,
  computeTodayKpis,
  pendingActionsTotal,
  topSellingActionHint,
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

  it('computes average ticket from today revenue and count', () => {
    const kpis = computeTodayKpis([
      order({ id: 'a', total_amount: 30 }),
      order({ id: 'b', total_amount: 50 }),
    ]);
    assert.equal(kpis.todayOrderCount, 2);
    assert.equal(kpis.todayRevenue, 80);
    assert.equal(kpis.avgTicketPrice, 40);
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
    const insights = buildFeedbackInsights(
      [{ session_id: 's1', completed_at: '2026-06-27T12:00:00.000Z' }],
      [{ session_id: 's1' }],
      [
        {
          menu_item_id: 'd1',
          vote: 'down',
          reasons: ['cold'],
          menu_items: { name_zh: '鱼', name_pt: 'Peixe', name_en: 'Fish' },
        },
      ],
      'zh',
    );
    assert.equal(insights.hasSufficientData, true);
    assert.equal(insights.topIssues.length, 1);
    assert.equal(insights.topIssues[0]?.dish_name, '鱼');
    assert.equal(insights.actionableRate, 1);
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

describe('topSellingActionHint', () => {
  it('marks rank 1 as hot', () => {
    assert.equal(topSellingActionHint(1, 0.6), 'hot');
  });

  it('marks rank 2–3 with meaningful share as stock', () => {
    assert.equal(topSellingActionHint(2, 0.4), 'stock');
    assert.equal(topSellingActionHint(3, 0.25), 'stock');
  });

  it('skips stock hint when share is too small', () => {
    assert.equal(topSellingActionHint(2, 0.1), null);
    assert.equal(topSellingActionHint(4, 0.5), null);
  });
});

describe('buildTopSellingRows', () => {
  it('computes volume share and attaches hints', () => {
    const rows = buildTopSellingRows([
      { name: 'Cola', count: 3, revenue: 3 },
      { name: 'Juice', count: 2, revenue: 4 },
    ]);
    assert.equal(rows.length, 2);
    assert.equal(rows[0]?.actionHint, 'hot');
    assert.equal(rows[0]?.volumeShare, 0.6);
    assert.equal(rows[1]?.actionHint, 'stock');
    assert.equal(rows[1]?.volumeShare, 0.4);
  });
});
