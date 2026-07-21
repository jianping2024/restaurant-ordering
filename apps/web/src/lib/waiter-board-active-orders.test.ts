import assert from 'node:assert/strict';
import test from 'node:test';
import {
  activeSessionOrderScope,
  activeSessionOrdersOrFilter,
} from '@/lib/waiter-board-active-orders';

test('activeSessionOrderScope returns null when no active sessions', () => {
  assert.equal(activeSessionOrderScope([]), null);
});

test('activeSessionOrderScope collects session and table ids', () => {
  const scope = activeSessionOrderScope([
    {
      id: 'sess-1',
      table_id: 'table-a',
      opened_at: '2026-01-01T12:00:00Z',
      status: 'open',
    },
    {
      id: 'sess-2',
      table_id: 'table-b',
      opened_at: '2026-01-01T12:05:00Z',
      status: 'billing',
    },
  ]);
  assert.deepEqual(scope, {
    activeSessionIds: ['sess-1', 'sess-2'],
    activeTableIds: ['table-a', 'table-b'],
  });
});

test('activeSessionOrdersOrFilter includes session and orphan table clauses', () => {
  const filter = activeSessionOrdersOrFilter({
    activeSessionIds: ['sess-1'],
    activeTableIds: ['table-a'],
  });
  assert.match(filter, /session_id\.in\.\(sess-1\)/);
  assert.match(filter, /table_id\.in\.\(table-a\)/);
  assert.match(filter, /session_id\.is\.null/);
});
