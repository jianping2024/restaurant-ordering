import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  boardSupportsBuffetOpenTable,
  isTableOccupiedForIdleOpen,
  type WaiterBoardOpenTableDefaults,
} from '@/lib/waiter-board-open-table';
import type { WaiterTablePageModel } from '@/lib/waiter-table-detail-types';

describe('boardSupportsBuffetOpenTable', () => {
  it('is false when open-table seed is absent', () => {
    assert.equal(boardSupportsBuffetOpenTable(null), false);
  });

  it('is true when open-table seed is present', () => {
    const defaults = {
      buffets: [{ id: 'b1', name: 'Lunch', is_active: true } as WaiterBoardOpenTableDefaults['buffets'][0]],
      buffetPricesByBuffetId: {},
    } satisfies WaiterBoardOpenTableDefaults;
    assert.equal(boardSupportsBuffetOpenTable(defaults), true);
  });
});

describe('isTableOccupiedForIdleOpen', () => {
  it('is false when session meta is absent', () => {
    const model = {
      detail: { table: { id: 't1' }, sessionMeta: null, orders: [] },
    } as WaiterTablePageModel;
    assert.equal(isTableOccupiedForIdleOpen(model), false);
  });

  it('is true when session meta is present', () => {
    const model = {
      detail: {
        table: { id: 't1' },
        sessionMeta: { sessionId: 's1', status: 'open' },
        orders: [],
      },
    } as WaiterTablePageModel;
    assert.equal(isTableOccupiedForIdleOpen(model), true);
  });
});
