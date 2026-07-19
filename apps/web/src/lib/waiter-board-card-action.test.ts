import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isWaiterBoardCardInteractive,
  resolveWaiterBoardCardAction,
  waiterBoardCardActionLabelKey,
} from '@/lib/waiter-board-card-action';

describe('resolveWaiterBoardCardAction', () => {
  const detailHref = '/dashboard/waiter/table-1';

  it('idle + active buffets opens sheet', () => {
    const action = resolveWaiterBoardCardAction({
      boardState: 'idle',
      canOpenCheckoutPendingTables: true,
      supportsBuffetOpenTable: true,
      detailHref,
    });
    assert.equal(action.kind, 'open_table_sheet');
  });

  it('idle without buffet config is disabled', () => {
    const action = resolveWaiterBoardCardAction({
      boardState: 'idle',
      canOpenCheckoutPendingTables: false,
      supportsBuffetOpenTable: false,
      detailHref,
    });
    assert.deepEqual(action, { kind: 'disabled', reason: 'no_buffet_config' });
  });

  it('dining navigates to table detail', () => {
    const action = resolveWaiterBoardCardAction({
      boardState: 'dining',
      canOpenCheckoutPendingTables: true,
      supportsBuffetOpenTable: true,
      detailHref,
    });
    assert.deepEqual(action, { kind: 'navigate', href: detailHref });
  });

  it('checkout on desk roles opens checkout sheet', () => {
    const action = resolveWaiterBoardCardAction({
      boardState: 'checkout',
      canOpenCheckoutPendingTables: true,
      supportsBuffetOpenTable: true,
      detailHref,
    });
    assert.deepEqual(action, { kind: 'open_checkout_sheet' });
  });

  it('checkout on waiter is display-only', () => {
    const action = resolveWaiterBoardCardAction({
      boardState: 'checkout',
      canOpenCheckoutPendingTables: false,
      supportsBuffetOpenTable: true,
      detailHref,
    });
    assert.deepEqual(action, { kind: 'disabled', reason: 'waiter_checkout' });
    assert.equal(isWaiterBoardCardInteractive(action), false);
  });
});

describe('waiterBoardCardActionLabelKey', () => {
  it('maps checkout sheet label on dashboard', () => {
    const key = waiterBoardCardActionLabelKey({ kind: 'open_checkout_sheet' }, 'checkout');
    assert.equal(key, 'cardActionCheckout');
  });

  it('maps waiter checkout display-only to awaiting-payment subtitle', () => {
    const key = waiterBoardCardActionLabelKey(
      { kind: 'disabled', reason: 'waiter_checkout' },
      'checkout',
    );
    assert.equal(key, 'checkoutPendingSubtitle');
  });
});
