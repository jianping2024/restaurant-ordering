import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { BillSplit, Order } from '@/types';
import {
  filterQualifyingClosedSessions,
  mergeForcedCloseSessionIds,
  todayGuestsForRevenueSessions,
  todayRevenueFromBundle,
  todayRevenueSessionIds,
  type ClosedSessionRevenueBundle,
} from '@/lib/analytics/closed-session-revenue';

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
    assert.deepEqual(revenue.todayGuests, { adults: 0, children: 0 });
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
    assert.deepEqual(revenue.todayGuests, { adults: 0, children: 0 });
  });

  it('sums todayGuests only for the same sessions as today table count', () => {
    const paidSplit = (sessionId: string, amount: number): BillSplit =>
      ({
        id: `sp-${sessionId}`,
        restaurant_id: 'r1',
        table_id: 't1',
        display_name: '1',
        session_id: sessionId,
        order_ids: [`o-${sessionId}`],
        split_mode: 'even',
        persons: [],
        result: [{ name: 'A', amount, paid: true }],
        total_amount: amount,
        status: 'paid',
        created_at: '2026-07-21T12:00:00.000Z',
        discount_rate: 0,
      }) as BillSplit;

    const lightOrders = new Map<string, Order[]>([
      [
        's1',
        [
          {
            id: 'o-s1',
            restaurant_id: 'r1',
            table_id: 't1',
            display_name: '1',
            session_id: 's1',
            status: 'done',
            items: [],
            total_amount: 40,
            created_at: '2026-07-21T10:00:00.000Z',
            updated_at: '2026-07-21T10:00:00.000Z',
          },
        ],
      ],
      [
        's2',
        [
          {
            id: 'o-s2',
            restaurant_id: 'r1',
            table_id: 't2',
            display_name: '2',
            session_id: 's2',
            status: 'done',
            items: [],
            total_amount: 30,
            created_at: '2026-07-21T10:00:00.000Z',
            updated_at: '2026-07-21T10:00:00.000Z',
          },
        ],
      ],
      [
        's3',
        [
          {
            id: 'o-s3',
            restaurant_id: 'r1',
            table_id: 't3',
            display_name: '3',
            session_id: 's3',
            status: 'done',
            items: [],
            total_amount: 20,
            created_at: '2026-07-21T10:00:00.000Z',
            updated_at: '2026-07-21T10:00:00.000Z',
          },
        ],
      ],
    ]);

    const revenueBundle = bundle({
      sessions: [
        { id: 's1', closed_at: '2026-07-21T12:00:00.000Z' },
        { id: 's2', closed_at: '2026-07-21T12:00:00.000Z' },
        { id: 's3', closed_at: '2026-07-21T12:00:00.000Z' },
      ],
      ordersBySession: lightOrders,
      splitsBySession: new Map([
        ['s1', [paidSplit('s1', 40)]],
        ['s2', [paidSplit('s2', 30)]],
        ['s3', [paidSplit('s3', 20)]],
      ]),
      forcedClosedSessionIds: new Set(['s3']),
    });

    const itemOrders = new Map([
      [
        's1',
        [
          {
            id: 'o-s1',
            session_id: 's1',
            status: 'done' as const,
            total_amount: 40,
            items: [
              {
                id: 'buffet:1',
                kind: 'buffet_base' as const,
                buffet_id: 'pkg',
                name: 'Buffet',
                name_pt: 'Buffet',
                qty: 1,
                price: 20,
                emoji: '🍽️',
                adult_count: 2,
                child_count: 1,
              },
            ],
          },
        ],
      ],
      [
        's2',
        [
          {
            id: 'o-s2',
            session_id: 's2',
            status: 'done' as const,
            total_amount: 30,
            items: [
              {
                id: 'buffet:2',
                kind: 'buffet_base' as const,
                buffet_id: 'pkg',
                name: 'Buffet',
                name_pt: 'Buffet',
                qty: 1,
                price: 20,
                emoji: '🍽️',
                adult_count: 3,
                child_count: 0,
              },
            ],
          },
        ],
      ],
      [
        's3',
        [
          {
            id: 'o-s3',
            session_id: 's3',
            status: 'done' as const,
            total_amount: 20,
            items: [
              {
                id: 'buffet:3',
                kind: 'buffet_base' as const,
                buffet_id: 'pkg',
                name: 'Buffet',
                name_pt: 'Buffet',
                qty: 1,
                price: 20,
                emoji: '🍽️',
                adult_count: 9,
                child_count: 9,
              },
            ],
          },
        ],
      ],
    ]);

    const sessionIds = todayRevenueSessionIds(revenueBundle, '2026-07-21');
    assert.deepEqual(sessionIds, ['s1', 's2']);
    assert.deepEqual(todayGuestsForRevenueSessions(sessionIds, itemOrders), {
      adults: 5,
      children: 1,
    });

    const revenue = todayRevenueFromBundle(revenueBundle, '2026-07-21', itemOrders);
    assert.equal(revenue.revenueSessionCount, 2);
    assert.deepEqual(revenue.todayGuests, { adults: 5, children: 1 });
  });

  it('excludes operational closed_reason via mergeForcedCloseSessionIds', () => {
    const merged = mergeForcedCloseSessionIds(
      [
        { id: 's1', closed_at: '2026-07-21T12:00:00.000Z', closed_reason: 'auto_nightly' },
        { id: 's2', closed_at: '2026-07-21T12:00:00.000Z', closed_reason: 'frontdesk_closed' },
      ],
      new Set(['s3']),
    );
    assert.equal(merged.has('s1'), true);
    assert.equal(merged.has('s2'), false);
    assert.equal(merged.has('s3'), true);
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
