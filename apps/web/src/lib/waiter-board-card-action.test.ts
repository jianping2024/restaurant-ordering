import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  resolveWaiterBoardCardAction,
  waiterBoardCardActionLabelKey,
} from '@/lib/waiter-board-card-action';

describe('resolveWaiterBoardCardAction', () => {
  const detailHref = '/r/waiter/table-1';

  it('idle + active buffets opens sheet', () => {
    const action = resolveWaiterBoardCardAction({
      boardState: 'idle',
      embeddedInDashboard: true,
      supportsBuffetOpenTable: true,
      detailHref,
    });
    assert.equal(action.kind, 'open_table_sheet');
  });

  it('idle without buffet config is disabled', () => {
    const action = resolveWaiterBoardCardAction({
      boardState: 'idle',
      embeddedInDashboard: false,
      supportsBuffetOpenTable: false,
      detailHref,
    });
    assert.deepEqual(action, { kind: 'disabled', reason: 'no_buffet_config' });
  });

  it('dining navigates to table detail', () => {
    const action = resolveWaiterBoardCardAction({
      boardState: 'dining',
      embeddedInDashboard: true,
      supportsBuffetOpenTable: true,
      detailHref,
    });
    assert.deepEqual(action, { kind: 'navigate', href: detailHref });
  });

  it('checkout on dashboard frontdesk opens checkout sheet', () => {
    const action = resolveWaiterBoardCardAction({
      boardState: 'checkout',
      embeddedInDashboard: true,
      supportsBuffetOpenTable: true,
      detailHref,
    });
    assert.deepEqual(action, { kind: 'open_checkout_sheet' });
  });

  it('checkout on slug waiter uses table detail', () => {
    const action = resolveWaiterBoardCardAction({
      boardState: 'checkout',
      embeddedInDashboard: false,
      supportsBuffetOpenTable: true,
      detailHref,
    });
    assert.deepEqual(action, { kind: 'navigate', href: detailHref });
  });
});

describe('waiterBoardCardActionLabelKey', () => {
  it('maps checkout sheet label on dashboard', () => {
    const key = waiterBoardCardActionLabelKey({ kind: 'open_checkout_sheet' }, 'checkout');
    assert.equal(key, 'cardActionCheckout');
  });

  it('maps slug checkout to view detail label', () => {
    const key = waiterBoardCardActionLabelKey(
      { kind: 'navigate', href: '/r/waiter/table-1' },
      'checkout',
    );
    assert.equal(key, 'cardActionViewDetail');
  });
});
