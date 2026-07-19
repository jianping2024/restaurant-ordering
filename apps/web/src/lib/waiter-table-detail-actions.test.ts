import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveWaiterTableDetailActions } from '@/lib/waiter-table-detail-actions';
import { floorBoardCapabilities } from '@/lib/floor-board-capabilities';

describe('resolveWaiterTableDetailActions', () => {
  const desk = floorBoardCapabilities('frontdesk');
  const waiter = floorBoardCapabilities('waiter');

  it('shows buffet panel for production open tables with buffet config', () => {
    const flags = resolveWaiterTableDetailActions({
      caps: desk,
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
        caps: desk,
        isDemo: false,
        isCheckoutPending: true,
        hasOpenSession: true,
        hasActiveBuffets: true,
      }).showBuffetPanel,
      false,
    );
    assert.equal(
      resolveWaiterTableDetailActions({
        caps: waiter,
        isDemo: true,
        isCheckoutPending: false,
        hasOpenSession: true,
        hasActiveBuffets: true,
      }).showBuffetPanel,
      false,
    );
  });

  it('limits checkout-close and close table to desk roles', () => {
    const waiterFlags = resolveWaiterTableDetailActions({
      caps: waiter,
      isDemo: false,
      isCheckoutPending: false,
      hasOpenSession: true,
      hasActiveBuffets: true,
    });
    assert.equal(waiterFlags.showOccupiedToolbar, true);
    assert.equal(waiterFlags.showCheckoutClose, false);
    assert.equal(waiterFlags.showCloseTable, false);

    const idle = resolveWaiterTableDetailActions({
      caps: desk,
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
      caps: waiter,
      isDemo: false,
      isCheckoutPending: false,
      hasOpenSession: true,
      hasActiveBuffets: true,
    });
    assert.equal(flags.showOccupiedToolbar, true);
    assert.equal(flags.showBuffetPanel, true);
  });
});
