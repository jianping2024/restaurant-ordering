import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { BillSplit, Order } from '@/types';
import {
  filterQualifyingClosedSessions,
  todayRevenueFromBundle,
} from '@/lib/analytics/closed-session-revenue';
import type { ClosedSessionRevenueBundle } from '@/lib/analytics/closed-session-revenue';

function bundle(partial: Partial<ClosedSessionRevenueBundle>): ClosedSessionRevenueBundle {
  return {
    sessions: [],
    ordersBySession: new Map(),
    splitsBySession: new Map(),
    forcedClosedSessionIds: new Set(),
    ...partial,
  };
}

describe('todayRevenueFromBundle', () => {
  it('counts revenue on closed_at day even when orders were created earlier', () => {
    const orders: Order[] = [
      {
        id: 'o1',
        restaurant_id: 'r1',
        table_id: 't1',
        display_name: '1',
        session_id: 's1',
        status: 'done',
        items: [],
        total_amount: 29.95,
        created_at: '2026-07-19T21:25:30.699494+00:00',
        updated_at: '2026-07-19T21:25:30.699494+00:00',
      },
    ];
    const splits: BillSplit[] = [
      {
        id: 'sp1',
        restaurant_id: 'r1',
        table_id: 't1',
        display_name: '1',
        session_id: 's1',
        order_ids: ['o1'],
        split_mode: 'even',
        persons: [],
        result: [{ name: 'A', amount: 29.95, paid: true }],
        total_amount: 29.95,
        status: 'paid',
        created_at: '2026-07-20T10:53:00.512305+00:00',
        discount_rate: 0,
      } as BillSplit,
    ];

    const ordersBySession = new Map<string, Order[]>([['s1', orders]]);
    const splitsBySession = new Map<string, BillSplit[]>([['s1', splits]]);
    const revenue = todayRevenueFromBundle(
      bundle({
        sessions: [{ id: 's1', closed_at: '2026-07-21T11:28:16.277508+00:00' }],
        ordersBySession,
        splitsBySession,
      }),
      '2026-07-21',
    );

    assert.equal(revenue.todayRevenue, 29.95);
    assert.equal(revenue.revenueSessionCount, 1);
  });

  it('excludes forced unpaid close sessions', () => {
    const orders: Order[] = [
      {
        id: 'o1',
        restaurant_id: 'r1',
        table_id: 't1',
        display_name: '1',
        session_id: 's1',
        status: 'done',
        items: [],
        total_amount: 100,
        created_at: '2026-07-21T10:00:00.000Z',
        updated_at: '2026-07-21T10:00:00.000Z',
      },
    ];

    const revenue = todayRevenueFromBundle(
      bundle({
        sessions: [{ id: 's1', closed_at: '2026-07-21T12:00:00.000Z' }],
        ordersBySession: new Map([['s1', orders]]),
        forcedClosedSessionIds: new Set(['s1']),
      }),
      '2026-07-21',
    );

    assert.equal(revenue.todayRevenue, 0);
    assert.equal(revenue.revenueSessionCount, 0);
  });
});

describe('filterQualifyingClosedSessions', () => {
  it('drops merge shells with zero totals and no paid split', () => {
    const sessions = [{ id: 's1', closed_at: '2026-07-21T12:00:00.000Z' }];
    const qualifying = filterQualifyingClosedSessions(
      sessions,
      new Map([['s1', []]]),
      new Map(),
    );
    assert.equal(qualifying.length, 0);
  });
});
