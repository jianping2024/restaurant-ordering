import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  boardSupportsBuffetOpenTable,
  type WaiterBoardOpenTableDefaults,
} from '@/lib/waiter-board-open-table';

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
