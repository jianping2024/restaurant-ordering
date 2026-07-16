import assert from 'node:assert/strict';
import test from 'node:test';
import type { Order } from '@/types';
import {
  activeWaiterTableIds,
  filterWaiterTableActionTargets,
  isWaiterTableCardOccupied,
} from './waiter-table-occupancy';
import { applyWaiterSessionRelocationToBoard } from './waiter-session-relocation-board';
import type { WaiterBoardData } from './staff-board';
import type { WaiterTablePageModel } from './waiter-table-detail-types';

const T1 = '00000000-0000-4000-8000-000000000001';
const T2 = '00000000-0000-4000-8000-000000000002';
const T3 = '00000000-0000-4000-8000-000000000003';

const tables = [
  { id: T1, display_name: 'A-01', sort_order: 1 },
  { id: T2, display_name: 'A-02', sort_order: 2 },
  { id: T3, display_name: 'A-03', sort_order: 3 },
];

const sessionMetaT1 = {
  [T1]: { sessionId: 's1', openedAt: '2026-06-25T10:00:00Z', status: 'open' as const },
};

test('isWaiterTableCardOccupied reflects buffet or menu lines', () => {
  assert.equal(isWaiterTableCardOccupied({ orderLines: [], hasBuffet: true }), true);
  assert.equal(
    isWaiterTableCardOccupied({ orderLines: [{}], hasBuffet: false }),
    true,
  );
  assert.equal(isWaiterTableCardOccupied({ orderLines: [], hasBuffet: false }), false);
});

test('activeWaiterTableIds ignores idle tables without orders or buffet', () => {
  const sessionMeta = {
    [T1]: { sessionId: 's1', openedAt: '2026-06-25T10:00:00Z', status: 'open' as const },
    [T2]: { sessionId: 's2', openedAt: '2026-06-25T10:00:00Z', status: 'open' as const },
  };
  const orders = [
    {
      id: 'o1',
      table_id: T1,
      session_id: 's1',
      status: 'done',
      items: [{ id: 'm1', name: 'Cola', qty: 1, kind: 'menu', status: 'done' }],
      created_at: '2026-06-25T10:01:00Z',
      updated_at: '2026-06-25T10:01:00Z',
    },
  ] as Order[];

  assert.deepEqual(activeWaiterTableIds(tables, orders, sessionMeta), [T1]);
});

test('filterWaiterTableActionTargets returns idle tables for transfer', () => {
  const targets = filterWaiterTableActionTargets(tables, T1, 'transfer', sessionMetaT1);
  assert.deepEqual(
    targets.map((t) => t.id),
    [T2, T3],
  );
});

test('filterWaiterTableActionTargets excludes tables with active sessions for transfer', () => {
  const sessionMeta = {
    [T1]: { sessionId: 's1', openedAt: '2026-06-25T10:00:00Z', status: 'open' as const },
    [T2]: { sessionId: 's2', openedAt: '2026-06-25T10:00:00Z', status: 'open' as const },
  };
  const targets = filterWaiterTableActionTargets(tables, T1, 'transfer', sessionMeta);
  assert.deepEqual(targets.map((t) => t.id), [T3]);
});

test('filterWaiterTableActionTargets returns active tables for merge', () => {
  const sessionMeta = {
    [T1]: { sessionId: 's1', openedAt: '2026-06-25T10:00:00Z', status: 'open' as const },
    [T2]: { sessionId: 's2', openedAt: '2026-06-25T10:00:00Z', status: 'open' as const },
  };
  const targets = filterWaiterTableActionTargets(tables, T1, 'merge', sessionMeta);
  assert.deepEqual(targets.map((t) => t.id), [T2]);
});

test('filterWaiterTableActionTargets excludes checkout tables from merge targets', () => {
  const sessionMeta = {
    [T1]: { sessionId: 's1', openedAt: '2026-06-25T10:00:00Z', status: 'open' as const },
    [T2]: { sessionId: 's2', openedAt: '2026-06-25T10:00:00Z', status: 'open' as const },
    [T3]: { sessionId: 's3', openedAt: '2026-06-25T10:00:00Z', status: 'billing' as const },
  };
  const targets = filterWaiterTableActionTargets(
    tables,
    T1,
    'merge',
    sessionMeta,
    [T3],
  );
  assert.deepEqual(targets.map((t) => t.id), [T2]);
});

test('applyWaiterSessionRelocationToBoard moves session from source to target', () => {
  const board: WaiterBoardData = {
    sessionMetaByTableId: sessionMetaT1,
    checkoutRequestedTableIds: [],
    checkoutRequestedAtByTableId: {},
    tables,
    groups: [],
    members: [],
    parties: [],
    partyMembers: [],
    tableSummaries: [
      {
        tableId: T1,
        displayName: 'A-01',
        seatMin: 1,
        seatMax: 4,
        buffetHeadcount: null,
        sessionTotal: 12,
        hasBuffet: false,
        occupied: true,
        updatedAt: '2026-06-25T10:01:00Z',
      },
      {
        tableId: T2,
        displayName: 'A-02',
        seatMin: 1,
        seatMax: 4,
        buffetHeadcount: null,
        sessionTotal: 0,
        hasBuffet: false,
        occupied: false,
        updatedAt: '2026-06-25T10:00:00Z',
      },
    ],
    restaurantHasActiveBuffets: false,
    openTableDefaults: null,
  };

  const targetModel = {
    detail: {
      table: tables[1],
      sessionMeta: {
        sessionId: 's1',
        openedAt: '2026-06-25T10:00:00Z',
        status: 'open' as const,
      },
      orders: [
        {
          id: 'o1',
          table_id: T2,
          session_id: 's1',
          status: 'done',
          items: [{ id: 'm1', name: 'Cola', qty: 1, kind: 'menu', status: 'done' }],
          created_at: '2026-06-25T10:01:00Z',
          updated_at: '2026-06-25T10:01:00Z',
        },
      ] as Order[],
      checkoutRequested: false,
      checkoutRequestedAt: null,
    },
    buffets: [],
    buffetPricesByBuffetId: {},
  } satisfies WaiterTablePageModel;

  const next = applyWaiterSessionRelocationToBoard(board, {
    sourceTableId: T1,
    targetModel,
  });

  assert.equal(next.sessionMetaByTableId[T1], undefined);
  assert.equal(next.sessionMetaByTableId[T2]?.sessionId, 's1');
  assert.equal(next.tableSummaries.find((row) => row.tableId === T1)?.occupied, false);
  assert.equal(next.tableSummaries.find((row) => row.tableId === T2)?.occupied, true);
});
