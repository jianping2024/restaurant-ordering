import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveWaiterBoardDashboardAccess } from './dashboard-waiter-board-access';
import { capabilitiesFromKeys } from './permissions/can';

const restaurant = {
  id: '88064a0b-1d36-4633-aa21-c928039e4f57',
  name: '白云',
  slug: 'restaurant-mohnrib5',
  logo_url: null,
  feature_flags: {},
  buffet_service_mode: 'classic' as const,
  suspended_at: null,
  suspension_reason: null,
};

describe('resolveWaiterBoardDashboardAccess', () => {
  it('allows store_owner with dashboard.waiter_board.view', () => {
    const decision = resolveWaiterBoardDashboardAccess(
      { mode: 'staff', restaurant },
      capabilitiesFromKeys(['dashboard.waiter_board.view']),
    );
    assert.equal(decision.ok, true);
    if (decision.ok) {
      assert.equal(decision.restaurant.slug, restaurant.slug);
    }
  });

  it('allows frontdesk with dashboard.waiter_board.view', () => {
    const decision = resolveWaiterBoardDashboardAccess(
      { mode: 'staff', restaurant },
      capabilitiesFromKeys(['dashboard.waiter_board.view']),
    );
    assert.equal(decision.ok, true);
  });

  it('redirects store_owner without waiter board capability to capability landing', () => {
    const decision = resolveWaiterBoardDashboardAccess(
      { mode: 'staff', restaurant },
      capabilitiesFromKeys(['dashboard.overview.view']),
    );
    assert.equal(decision.ok, false);
    if (!decision.ok) {
      assert.equal(decision.redirectTo, '/dashboard');
    }
  });

  it('redirects unauthenticated to login', () => {
    const decision = resolveWaiterBoardDashboardAccess(
      { mode: 'unauthenticated' },
      capabilitiesFromKeys(['dashboard.waiter_board.view']),
    );
    assert.equal(decision.ok, false);
    if (!decision.ok) {
      assert.equal(decision.redirectTo, '/auth/login');
    }
  });

  it('redirects kitchen-only staff to kitchen board', () => {
    const decision = resolveWaiterBoardDashboardAccess(
      { mode: 'staff', restaurant: { id: restaurant.id, name: restaurant.name, slug: restaurant.slug, buffet_service_mode: 'classic', logo_url: null, feature_flags: {}, suspended_at: null, suspension_reason: null } },
      capabilitiesFromKeys(['floor.kitchen_board.view']),
    );
    assert.equal(decision.ok, false);
    if (!decision.ok) {
      assert.equal(decision.redirectTo, '/restaurant-mohnrib5/kitchen');
    }
  });
});
