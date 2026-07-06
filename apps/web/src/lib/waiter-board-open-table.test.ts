import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  boardSupportsBuffetOpenTable,
  isOpenTableSheetSubmitBlocked,
  shouldStartOpenTableReconcile,
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

describe('open table sheet reconcile helpers', () => {
  it('blocks submit only while reconcile is pending and enabled', () => {
    assert.equal(isOpenTableSheetSubmitBlocked(true, 'pending'), true);
    assert.equal(isOpenTableSheetSubmitBlocked(true, 'settled'), false);
    assert.equal(isOpenTableSheetSubmitBlocked(false, 'pending'), false);
    assert.equal(shouldStartOpenTableReconcile(true, true, true), true);
    assert.equal(shouldStartOpenTableReconcile(true, true, false), false);
    assert.equal(shouldStartOpenTableReconcile(true, false, true), false);
  });
});
