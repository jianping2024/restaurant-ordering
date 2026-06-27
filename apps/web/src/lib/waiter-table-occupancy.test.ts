import assert from 'node:assert/strict';
import test from 'node:test';
import type { Order } from '@/types';
import {
  activeWaiterTableIds,
  filterWaiterTableActionTargets,
  isWaiterTableCardOccupied,
} from './waiter-table-occupancy';

const T1 = '00000000-0000-4000-8000-000000000001';
const T2 = '00000000-0000-4000-8000-000000000002';
const T3 = '00000000-0000-4000-8000-000000000003';

const tables = [
  { id: T1, display_name: 'A-01', sort_order: 1 },
  { id: T2, display_name: 'A-02', sort_order: 2 },
  { id: T3, display_name: 'A-03', sort_order: 3 },
];

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
  const targets = filterWaiterTableActionTargets(tables, [T1], T1, 'transfer');
  assert.deepEqual(
    targets.map((t) => t.id),
    [T2, T3],
  );
});

test('filterWaiterTableActionTargets returns active tables for merge', () => {
  const targets = filterWaiterTableActionTargets(tables, [T1, T2], T1, 'merge');
  assert.deepEqual(targets.map((t) => t.id), [T2]);
});
