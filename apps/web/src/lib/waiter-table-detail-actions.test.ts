import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveWaiterTableDetailActions } from '@/lib/waiter-table-detail-actions';

describe('resolveWaiterTableDetailActions', () => {
  it('shows buffet panel for production open tables with buffet config', () => {
    const flags = resolveWaiterTableDetailActions({
      embeddedInDashboard: true,
      isDemo: false,
      isCheckoutPending: false,
      hasOpenSession: true,
      hasActiveBuffets: true,
    });
    assert.equal(flags.showBuffetPanel, true);
    assert.equal(flags.showOccupiedToolbar, true);
    assert.equal(flags.showCheckoutClose, true);
    assert.equal(flags.showCloseTable, true);
  });

  it('hides buffet panel during checkout and in demo', () => {
    assert.equal(
      resolveWaiterTableDetailActions({
        embeddedInDashboard: true,
        isDemo: false,
        isCheckoutPending: true,
        hasOpenSession: true,
        hasActiveBuffets: true,
      }).showBuffetPanel,
      false,
    );
    assert.equal(
      resolveWaiterTableDetailActions({
        embeddedInDashboard: false,
        isDemo: true,
        isCheckoutPending: false,
        hasOpenSession: true,
        hasActiveBuffets: true,
      }).showBuffetPanel,
      false,
    );
  });

  it('limits checkout-close and close table to frontdesk on open sessions', () => {
    const waiter = resolveWaiterTableDetailActions({
      embeddedInDashboard: false,
      isDemo: false,
      isCheckoutPending: false,
      hasOpenSession: true,
      hasActiveBuffets: true,
    });
    assert.equal(waiter.showOccupiedToolbar, true);
    assert.equal(waiter.showCheckoutClose, false);
    assert.equal(waiter.showCloseTable, false);

    const idle = resolveWaiterTableDetailActions({
      embeddedInDashboard: true,
      isDemo: false,
      isCheckoutPending: false,
      hasOpenSession: false,
      hasActiveBuffets: true,
    });
    assert.equal(idle.showOccupiedToolbar, false);
    assert.equal(idle.showCheckoutClose, false);
    assert.equal(idle.showCloseTable, false);
  });

  it('shows toolbar for session-only tables without buffet lines', () => {
    const flags = resolveWaiterTableDetailActions({
      embeddedInDashboard: false,
      isDemo: false,
      isCheckoutPending: false,
      hasOpenSession: true,
      hasActiveBuffets: true,
    });
    assert.equal(flags.showOccupiedToolbar, true);
    assert.equal(flags.showBuffetPanel, true);
  });
});
