import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveWaiterTableDetailActions } from '@/lib/waiter-table-detail-actions';
import { floorBoardCapabilitiesFromCaps } from '@/lib/permissions/resolve';
import { capabilitiesFromKeys } from '@/lib/permissions/can';
import { ROLE_TEMPLATES } from '@/lib/permissions/role-templates';

describe('resolveWaiterTableDetailActions', () => {
  const frontdeskCaps = capabilitiesFromKeys([...ROLE_TEMPLATES.frontdesk]);
  const waiterCaps = capabilitiesFromKeys([...ROLE_TEMPLATES.waiter]);
  const cashierCaps = capabilitiesFromKeys([...ROLE_TEMPLATES.cashier]);
  
  const desk = floorBoardCapabilitiesFromCaps(frontdeskCaps);
  const waiter = floorBoardCapabilitiesFromCaps(waiterCaps);
  const cashier = floorBoardCapabilitiesFromCaps(cashierCaps);

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
    assert.equal(flags.showTransfer, true);
    assert.equal(flags.showMerge, true);
    assert.equal(flags.showCheckoutClose, true);
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

  it('limits checkout-close to desk roles with an open session', () => {
    const waiterFlags = resolveWaiterTableDetailActions({
      caps: waiter,
      isDemo: false,
      isCheckoutPending: false,
      hasOpenSession: true,
      hasActiveBuffets: true,
    });
    assert.equal(waiterFlags.showOccupiedToolbar, true);
    assert.equal(waiterFlags.showTransfer, true);
    assert.equal(waiterFlags.showMerge, true);
    assert.equal(waiterFlags.showCheckoutClose, false);

    const idle = resolveWaiterTableDetailActions({
      caps: desk,
      isDemo: false,
      isCheckoutPending: false,
      hasOpenSession: false,
      hasActiveBuffets: true,
    });
    assert.equal(idle.showOccupiedToolbar, false);
    assert.equal(idle.showTransfer, false);
    assert.equal(idle.showMerge, false);
    assert.equal(idle.showCheckoutClose, false);
  });

  it('allows cashier checkout-close when session is open', () => {
    const flags = resolveWaiterTableDetailActions({
      caps: cashier,
      isDemo: false,
      isCheckoutPending: false,
      hasOpenSession: true,
      hasActiveBuffets: false,
    });
    assert.equal(flags.showCheckoutClose, true);
    assert.equal(flags.showTransfer, true);
    assert.equal(flags.showMerge, true);
  });

  it('hides transfer/merge without capability even when session is open', () => {
    const noRelocate = floorBoardCapabilitiesFromCaps(
      capabilitiesFromKeys(['tables.checkout_close']),
    );
    const flags = resolveWaiterTableDetailActions({
      caps: noRelocate,
      isDemo: false,
      isCheckoutPending: false,
      hasOpenSession: true,
      hasActiveBuffets: false,
    });
    assert.equal(flags.showTransfer, false);
    assert.equal(flags.showMerge, false);
    assert.equal(flags.showCheckoutClose, true);
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
