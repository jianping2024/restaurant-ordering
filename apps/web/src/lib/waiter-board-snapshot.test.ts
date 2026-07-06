import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Order } from '@/types';
import {
  buildWaiterBoardTableSummaries,
  sortWaiterBoardTableSummaries,
  waiterBoardSummaryToSortInput,
} from './waiter-board-snapshot';

const TABLE_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const TABLE_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const SESSION = 'ssssssss-ssss-ssss-ssss-ssssssssssss';

const tables = [
  { id: TABLE_A, display_name: '1', sort_order: 1 },
  { id: TABLE_B, display_name: '2', sort_order: 2 },
];

describe('buildWaiterBoardTableSummaries', () => {
  it('marks idle table unoccupied with zero totals', () => {
    const summaries = buildWaiterBoardTableSummaries(tables, [], {});
    const a = summaries.find((row) => row.tableId === TABLE_A);
    assert.ok(a);
    assert.equal(a.occupied, false);
    assert.equal(a.buffetHeadcount, null);
    assert.equal(a.sessionTotal, 0);
  });

  it('aggregates session orders for an open table', () => {
    const orders = [
      {
        id: 'o1',
        restaurant_id: 'r1',
        session_id: SESSION,
        table_id: TABLE_A,
        display_name: '1',
        status: 'pending',
        items: [
          {
            id: 'm1',
            name: 'Soup',
            name_pt: 'Soup',
            qty: 2,
            price: 5,
            emoji: '🍲',
          },
        ],
        total_amount: 10,
        created_at: '2026-01-01T10:00:00Z',
        updated_at: '2026-01-01T10:05:00Z',
      },
    ] as Order[];

    const summaries = buildWaiterBoardTableSummaries(tables, orders, {
      [TABLE_A]: { sessionId: SESSION, openedAt: '2026-01-01T10:00:00Z', status: 'open' },
    });
    const a = summaries.find((row) => row.tableId === TABLE_A)!;
    assert.equal(a.occupied, true);
    assert.equal(a.buffetHeadcount, null);
    assert.equal(a.sessionTotal, 10);
  });

  it('derives buffet headcount from active buffet_base line', () => {
    const orders = [
      {
        id: 'o1',
        restaurant_id: 'r1',
        session_id: SESSION,
        table_id: TABLE_A,
        display_name: '1',
        status: 'done',
        items: [
          {
            id: 'b1',
            kind: 'buffet_base',
            name: 'Buffet',
            name_pt: 'Buffet',
            qty: 1,
            price: 20,
            emoji: '🍽️',
            adult_count: 3,
            child_count: 2,
            buffet_id: 'buffet-1',
            added_at: '2026-01-01T10:00:00Z',
          },
        ],
        total_amount: 80,
        created_at: '2026-01-01T10:00:00Z',
        updated_at: '2026-01-01T10:00:00Z',
      },
    ] as Order[];

    const summaries = buildWaiterBoardTableSummaries(tables, orders, {
      [TABLE_A]: { sessionId: SESSION, openedAt: '2026-01-01T10:00:00Z', status: 'open' },
    });
    const a = summaries.find((row) => row.tableId === TABLE_A)!;
    assert.deepEqual(a.buffetHeadcount, { adults: 3, children: 2 });
    assert.equal(a.hasBuffet, true);
  });
});

describe('waiterBoardSummaryToSortInput', () => {
  it('uses placeholder line when occupied by menu only', () => {
    const input = waiterBoardSummaryToSortInput({
      tableId: TABLE_A,
      displayName: '1',
      buffetHeadcount: { adults: 1, children: 0 },
      sessionTotal: 5,
      hasBuffet: false,
      occupied: true,
      updatedAt: '',
    });
    assert.equal(input.orderLines.length, 1);
  });
});

describe('sortWaiterBoardTableSummaries', () => {
  it('ranks checkout pending before idle tables', () => {
    const summaries = [
      {
        tableId: TABLE_A,
        displayName: '1',
        buffetHeadcount: null,
        sessionTotal: 0,
        hasBuffet: false,
        occupied: false,
        updatedAt: '',
      },
      {
        tableId: TABLE_B,
        displayName: '2',
        buffetHeadcount: { adults: 2, children: 0 },
        sessionTotal: 20,
        hasBuffet: false,
        occupied: true,
        updatedAt: '',
      },
    ];
    const sorted = sortWaiterBoardTableSummaries(
      summaries,
      tables,
      [TABLE_B],
      {
        [TABLE_B]: { sessionId: SESSION, openedAt: '2026-01-01T10:00:00Z', status: 'billing' },
      },
    );
    assert.equal(sorted[0]?.tableId, TABLE_B);
  });
});
