import assert from 'node:assert/strict';
import test from 'node:test';
import type { Order } from '@/types';
import {
  filterOrdersInActiveSessions,
  sessionMetaByTableIdFromSessions,
} from './waiter-board-query';

test('sessionMetaByTableIdFromSessions attaches openedByName when resolver map has a match', () => {
  const map = sessionMetaByTableIdFromSessions(
    [
      {
        id: 's1',
        table_id: '00000000-0000-4000-8000-000000000001',
        opened_at: '2026-06-25T10:00:00Z',
        status: 'open',
        opened_by_user_id: 'u1',
      },
    ],
    new Map([['u1', '张三']]),
  );
  assert.equal(map['00000000-0000-4000-8000-000000000001'].openedByName, '张三');
});

test('sessionMetaByTableIdFromSessions keeps open and billing sessions only', () => {
  const map = sessionMetaByTableIdFromSessions([
    {
      id: 's1',
      table_id: '00000000-0000-4000-8000-000000000001',
      opened_at: '2026-06-25T10:00:00Z',
      status: 'open',
    },
    {
      id: 's2',
      table_id: '00000000-0000-4000-8000-000000000002',
      opened_at: '2026-06-25T10:00:00Z',
      status: 'closed',
    },
  ]);
  assert.deepEqual(Object.keys(map), ['00000000-0000-4000-8000-000000000001']);
  assert.equal(map['00000000-0000-4000-8000-000000000001'].sessionId, 's1');
});

test('filterOrdersInActiveSessions drops orders on closed sessions', () => {
  const sessions = [{ id: 's1' }];
  const orders = [
    { id: 'o1', session_id: 's1' },
    { id: 'o2', session_id: 's2' },
    { id: 'o3', session_id: null, table_id: '00000000-0000-4000-8000-000000000001' },
  ] as Order[];
  const kept = filterOrdersInActiveSessions(orders, sessions);
  assert.deepEqual(
    kept.map((o) => o.id),
    ['o1', 'o3'],
  );
});
