import assert from 'node:assert/strict';
import { describe, it, mock, afterEach } from 'node:test';
import {
  NEW_BATCH_HIGHLIGHT_MS,
  completeStaffAssistedOrderSubmit,
  markLatestSubmittedBatch,
} from './menu-order-submit-outcome';

describe('menu-order-submit-outcome', () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it('markLatestSubmittedBatch clears highlight after NEW_BATCH_HIGHLIGHT_MS', () => {
    mock.timers.enable({ apis: ['setTimeout'] });
    const ids: Array<string | null> = [];
    const setLatestBatchId = (id: string | null) => ids.push(id);

    markLatestSubmittedBatch('batch-1', setLatestBatchId);
    assert.deepEqual(ids, ['batch-1']);

    mock.timers.tick(NEW_BATCH_HIGHLIGHT_MS);
    assert.deepEqual(ids, ['batch-1', null]);
    mock.timers.reset();
  });

  it('completeStaffAssistedOrderSubmit clears cart and navigates immediately', () => {
    const clearCart = mock.fn();
    const navigate = mock.fn();

    completeStaffAssistedOrderSubmit({
      returnHref: '/dashboard/waiter/table-1',
      clearCart,
      navigate,
    });

    assert.equal(clearCart.mock.calls.length, 1);
    assert.deepEqual(navigate.mock.calls[0]?.arguments, ['/dashboard/waiter/table-1']);
  });
});
