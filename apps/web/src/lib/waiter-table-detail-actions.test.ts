import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveWaiterTableDetailActions } from '@/lib/waiter-table-detail-actions';

describe('resolveWaiterTableDetailActions', () => {
  it('shows buffet panel for production open tables with buffet config', () => {
    const flags = resolveWaiterTableDetailActions({
      embeddedInDashboard: true,
      isDemo: false,
      isCheckoutPending: false,
      isOccupied: true,
      hasActiveBuffets: true,
    });
    assert.equal(flags.showBuffetPanel, true);
    assert.equal(flags.showOccupiedToolbar, true);
    assert.equal(flags.showCallBill, true);
    assert.equal(flags.showCloseTable, true);
  });

  it('hides buffet panel during checkout and in demo', () => {
    assert.equal(
      resolveWaiterTableDetailActions({
        embeddedInDashboard: true,
        isDemo: false,
        isCheckoutPending: true,
        isOccupied: true,
        hasActiveBuffets: true,
      }).showBuffetPanel,
      false,
    );
    assert.equal(
      resolveWaiterTableDetailActions({
        embeddedInDashboard: false,
        isDemo: true,
        isCheckoutPending: false,
        isOccupied: true,
        hasActiveBuffets: true,
      }).showBuffetPanel,
      false,
    );
  });

  it('limits call bill and close table to frontdesk on occupied tables', () => {
    const waiter = resolveWaiterTableDetailActions({
      embeddedInDashboard: false,
      isDemo: false,
      isCheckoutPending: false,
      isOccupied: true,
      hasActiveBuffets: true,
    });
    assert.equal(waiter.showOccupiedToolbar, true);
    assert.equal(waiter.showCallBill, false);
    assert.equal(waiter.showCloseTable, false);

    const idle = resolveWaiterTableDetailActions({
      embeddedInDashboard: true,
      isDemo: false,
      isCheckoutPending: false,
      isOccupied: false,
      hasActiveBuffets: true,
    });
    assert.equal(idle.showOccupiedToolbar, false);
    assert.equal(idle.showCallBill, false);
    assert.equal(idle.showCloseTable, false);
  });
});
