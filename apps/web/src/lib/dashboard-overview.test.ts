import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Order } from '@/types';
import {
  buildFeedbackInsights,
  buildTodayTopSellingItems,
  buildTopSellingRows,
  computeDiningFloorKpis,
  computeTodayKpis,
  localizeTopSellingItems,
  pendingActionsTotal,
} from '@/lib/dashboard-overview';
import { pickTrilingualName } from '@/lib/i18n/pick-trilingual-name';

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

const emptyDining = { diningTableCount: 0, diningGuests: { adults: 0, children: 0 } };

describe('computeTodayKpis', () => {
  it('keeps today table count aligned with closed-session revenue set', () => {
    const kpis = computeTodayKpis(
      {
        todayRevenue: 29.95,
        revenueSessionCount: 2,
        todayGuests: { adults: 5, children: 1 },
      },
      emptyDining,
    );
    assert.equal(kpis.todayTableCount, 2);
    assert.equal(kpis.todayRevenue, 29.95);
    assert.equal(kpis.revenueAvailable, true);
    assert.deepEqual(kpis.todayGuests, { adults: 5, children: 1 });
    assert.equal(kpis.diningTableCount, 0);
    assert.deepEqual(kpis.diningGuests, { adults: 0, children: 0 });
  });

  it('marks revenue unavailable when bundle load failed', () => {
    const kpis = computeTodayKpis(null, {
      diningTableCount: 2,
      diningGuests: { adults: 4, children: 1 },
    });
    assert.equal(kpis.todayTableCount, 0);
    assert.equal(kpis.todayRevenue, 0);
    assert.equal(kpis.revenueAvailable, false);
    assert.deepEqual(kpis.todayGuests, { adults: 0, children: 0 });
    assert.equal(kpis.diningTableCount, 2);
    assert.deepEqual(kpis.diningGuests, { adults: 4, children: 1 });
  });
});

describe('computeDiningFloorKpis', () => {
  it('sums per-session headcount even when buffet_id is shared', () => {
    const dining = computeDiningFloorKpis(2, [
      order({
        id: 'o1',
        session_id: 's1',
        table_id: 't1',
        status: 'pending',
        items: [
          {
            id: 'buffet:1',
            kind: 'buffet_base',
            buffet_id: 'pkg',
            name: 'Buffet',
            name_pt: 'Buffet',
            qty: 1,
            price: 20,
            emoji: '🍽️',
            adult_count: 3,
            child_count: 1,
          },
        ],
      }),
      order({
        id: 'o2',
        session_id: 's2',
        table_id: 't2',
        status: 'cooking',
        items: [
          {
            id: 'buffet:2',
            kind: 'buffet_base',
            buffet_id: 'pkg',
            name: 'Buffet',
            name_pt: 'Buffet',
            qty: 1,
            price: 20,
            emoji: '🍽️',
            adult_count: 2,
            child_count: 0,
          },
        ],
      }),
    ]);
    assert.equal(dining.diningTableCount, 2);
    assert.deepEqual(dining.diningGuests, { adults: 5, children: 1 });
  });

  it('returns zero guests when no buffet_base lines', () => {
    const dining = computeDiningFloorKpis(1, [
      order({ id: 'o1', session_id: 's1', status: 'pending', items: [] }),
    ]);
    assert.equal(dining.diningTableCount, 1);
    assert.deepEqual(dining.diningGuests, { adults: 0, children: 0 });
  });
});

describe('buildTodayTopSellingItems', () => {
  it('aggregates menu lines and excludes voided or buffet base rows', () => {
    const top = buildTodayTopSellingItems([
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
    ]);

    assert.equal(top.length, 1);
    assert.equal(pickTrilingualName(top[0]!, 'zh') || top[0]?.namePt, 'Cola');
    assert.equal(localizeTopSellingItems(top, 'zh')[0]?.name, 'Cola');
    assert.equal(top[0]?.count, 2);
    assert.equal(top[0]?.revenue, 6);
  });
});

describe('buildFeedbackInsights', () => {
  it('uses compact empty-state when billed sessions exist but no feedback samples', () => {
    const insights = buildFeedbackInsights([], [{ session_id: 's1' }], []);
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

    const insights = buildFeedbackInsights(sessions, billed, rows);

    assert.equal(insights.hasSufficientData, true);
    assert.equal(insights.topIssues.length, 1);
    assert.equal(pickTrilingualName(insights.topIssues[0]!, 'zh'), '鱼');
    assert.equal(pickTrilingualName(insights.topIssues[0]!, 'en'), 'Fish');
    assert.equal(insights.actionableRate, 1);
  });
});

describe('pendingActionsTotal', () => {
  it('sums checkout, print, and entitled abnormal buckets', () => {
    assert.equal(
      pendingActionsTotal({
        pendingCheckout: 1,
        pendingAbnormal: 2,
        pendingPrint: 3,
      }),
      6,
    );
  });

  it('treats null abnormal as not entitled (excluded from total)', () => {
    assert.equal(
      pendingActionsTotal({
        pendingCheckout: 1,
        pendingAbnormal: null,
        pendingPrint: 3,
      }),
      4,
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
