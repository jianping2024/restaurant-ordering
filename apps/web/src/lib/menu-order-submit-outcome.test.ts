import assert from 'node:assert/strict';
import { describe, it, mock, afterEach } from 'node:test';
import {
  completeGuestOrderSubmit,
  completeStaffAssistedOrderSubmit,
  staffReturnHrefAfterMenuSubmit,
} from './menu-order-submit-outcome';

describe('menu-order-submit-outcome', () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it('staffReturnHrefAfterMenuSubmit appends from=menu_submit', () => {
    assert.equal(
      staffReturnHrefAfterMenuSubmit('/dashboard/waiter/abc'),
      '/dashboard/waiter/abc?from=menu_submit',
    );
    assert.equal(
      staffReturnHrefAfterMenuSubmit('/cafe/waiter/abc?tab=orders'),
      '/cafe/waiter/abc?tab=orders&from=menu_submit',
    );
  });

  it('completeGuestOrderSubmit clears cart then signals footer feedback', () => {
    const order: string[] = [];
    completeGuestOrderSubmit({
      clearCart: () => order.push('clear'),
      signalSubmitted: () => order.push('signal'),
    });
    assert.deepEqual(order, ['clear', 'signal']);
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
    assert.deepEqual(navigate.mock.calls[0]?.arguments, [
      '/dashboard/waiter/table-1?from=menu_submit',
    ]);
  });
});
