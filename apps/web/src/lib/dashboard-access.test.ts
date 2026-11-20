import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isCashierCheckoutPath,
  isCashierOperationalPath,
  isDashboardSettingsPath,
  isDashboardWaiterBoardPath,
  isFrontdeskOperationalPath,
  isWaiterOperationalPath,
  shouldPrefetchDashboardNav,
} from './dashboard-paths';
import { resolveDashboardOperationalContext } from './dashboard-operational-context';
import { capabilitiesFromKeys } from './permissions/can';
import { resolveCapabilitiesForOwner } from './permissions/resolve';
import { isStaffRole } from './staff-account';
import {
  dashboardCapabilityMiddlewareRedirectPath,
  middlewareAllowsPathForCapabilities,
} from './dashboard-feature-registry';
import { ROLE_TEMPLATES } from './permissions/role-templates';

describe('isDashboardSettingsPath', () => {
  it('matches settings root and nested routes', () => {
    assert.equal(isDashboardSettingsPath('/dashboard/r/demo/settings'), true);
    assert.equal(isDashboardSettingsPath('/dashboard/r/demo/settings/staff'), true);
    assert.equal(isDashboardSettingsPath('/dashboard/r/demo/checkout'), false);
  });
});

describe('isCashierCheckoutPath', () => {
  it('matches checkout routes only', () => {
    assert.equal(isCashierCheckoutPath('/dashboard/r/demo/checkout'), true);
    assert.equal(isCashierCheckoutPath('/dashboard/r/demo/checkout/foo'), true);
    assert.equal(isCashierCheckoutPath('/dashboard/r/demo/orders'), false);
  });
});

describe('isCashierOperationalPath', () => {
  it('matches waiter board and checkout routes only', () => {
    assert.equal(isCashierOperationalPath('/dashboard/r/demo/waiter'), true);
    assert.equal(isCashierOperationalPath('/dashboard/r/demo/waiter/table-1'), true);
    assert.equal(isCashierOperationalPath('/dashboard/r/demo/checkout'), true);
    assert.equal(isCashierOperationalPath('/dashboard/r/demo/orders'), false);
    assert.equal(isDashboardWaiterBoardPath('/dashboard/r/demo/waiter/foo'), true);
  });
});

describe('isFrontdeskOperationalPath', () => {
  it('allows operational dashboard routes except settings', () => {
    assert.equal(isFrontdeskOperationalPath('/dashboard/r/demo'), true);
    assert.equal(isFrontdeskOperationalPath('/dashboard/r/demo/tables'), true);
    assert.equal(isFrontdeskOperationalPath('/dashboard/r/demo/menu'), true);
    assert.equal(isFrontdeskOperationalPath('/dashboard/r/demo/waiter'), true);
    assert.equal(isFrontdeskOperationalPath('/dashboard/r/demo/settings'), false);
    assert.equal(isFrontdeskOperationalPath('/dashboard/r/demo/settings/menu'), false);
    assert.equal(isFrontdeskOperationalPath('/auth/login'), false);
  });
});

describe('isWaiterOperationalPath', () => {
  it('matches waiter board only', () => {
    assert.equal(isWaiterOperationalPath('/dashboard/r/demo/waiter'), true);
    assert.equal(isWaiterOperationalPath('/dashboard/r/demo/waiter/t1'), true);
    assert.equal(isWaiterOperationalPath('/dashboard/r/demo/checkout'), false);
  });
});

describe('isStaffRole', () => {
  it('accepts known staff roles only', () => {
    assert.equal(isStaffRole('kitchen'), true);
    assert.equal(isStaffRole('waiter'), true);
    assert.equal(isStaffRole('cashier'), true);
    assert.equal(isStaffRole('frontdesk'), true);
    assert.equal(isStaffRole('owner'), true);
    assert.equal(isStaffRole('print_agent'), false);
    assert.equal(isStaffRole(''), false);
  });
});

describe('shouldPrefetchDashboardNav', () => {
  it('allows light settings tabs and denies heavy settings tabs', () => {
    assert.equal(shouldPrefetchDashboardNav('/dashboard/r/demo/settings'), true);
    assert.equal(shouldPrefetchDashboardNav('/dashboard/r/demo/settings/staff'), true);
    assert.equal(shouldPrefetchDashboardNav('/dashboard/r/demo/settings/features'), true);
    assert.equal(shouldPrefetchDashboardNav('/dashboard/r/demo/settings/buffet'), false);
    assert.equal(shouldPrefetchDashboardNav('/dashboard/r/demo/settings/print-assistant'), false);
    assert.equal(shouldPrefetchDashboardNav('/dashboard/r/demo/value-analytics'), false);
    assert.equal(shouldPrefetchDashboardNav('/dashboard/r/demo/tables'), true);
  });
});

describe('resolveDashboardOperationalContext', () => {
  const restaurant = {
    id: 'r1',
    name: 'Test',
    slug: 'test',
    logo_url: null,
    feature_flags: {},
    buffet_service_mode: 'classic' as const,
    suspended_at: null,
    suspension_reason: null,
  };
  const overviewCaps = capabilitiesFromKeys(['dashboard.overview.view']);

  it('allows access when capability matches', () => {
    assert.deepEqual(
      resolveDashboardOperationalContext(
        { mode: 'owner', restaurant: restaurant as never, loaded: { restaurantId: restaurant.id } as never },
        resolveCapabilitiesForOwner(),
        'dashboard.overview.view',
      ),
      { restaurantId: 'r1' },
    );
    assert.deepEqual(
      resolveDashboardOperationalContext(
        { mode: 'staff', restaurant, loaded: { restaurantId: restaurant.id } as never },
        overviewCaps,
        'dashboard.overview.view',
      ),
      { restaurantId: 'r1' },
    );
  });

  it('rejects missing capability', () => {
    assert.deepEqual(
      resolveDashboardOperationalContext(
        { mode: 'staff', restaurant, loaded: { restaurantId: restaurant.id } as never },
        capabilitiesFromKeys(['dashboard.waiter_board.view']),
        'dashboard.overview.view',
      ),
      { error: 'forbidden', status: 403 },
    );
  });

  it('rejects unauthenticated access', () => {
    assert.deepEqual(
      resolveDashboardOperationalContext(
        { mode: 'unauthenticated' },
        null,
        'dashboard.overview.view',
      ),
      {
        error: 'unauthorized',
        status: 401,
      },
    );
  });

  it('blocks writable context when restaurant is suspended', () => {
    assert.deepEqual(
      resolveDashboardOperationalContext(
        {
          mode: 'staff',
          restaurant: { ...restaurant, suspended_at: '2026-01-01T00:00:00Z' },
          loaded: { restaurantId: restaurant.id } as never,
        },
        overviewCaps,
        'dashboard.overview.view',
        { requireWritable: true },
      ),
      { error: 'restaurant_suspended', status: 403 },
    );
  });
});

describe('middlewareAllowsPathForCapabilities', () => {
  it('uses dashboard route permissions from capability set', () => {
    const frontdeskCaps = capabilitiesFromKeys([...ROLE_TEMPLATES.frontdesk]);
    // Pirata frontdesk has no overview — landing is not /dashboard.
    assert.equal(middlewareAllowsPathForCapabilities(frontdeskCaps, ''), false);
    assert.equal(middlewareAllowsPathForCapabilities(frontdeskCaps, '/guest-notice'), true);
    assert.equal(middlewareAllowsPathForCapabilities(frontdeskCaps, '/menu'), true);
    assert.equal(middlewareAllowsPathForCapabilities(frontdeskCaps, '/settings'), false);

    const cashierCaps = capabilitiesFromKeys([...ROLE_TEMPLATES.cashier]);
    assert.equal(middlewareAllowsPathForCapabilities(cashierCaps, '/checkout'), true);
    assert.equal(middlewareAllowsPathForCapabilities(cashierCaps, '/menu'), false);
  });

  it('owner star shares the same middleware path gate', () => {
    const ownerCaps = resolveCapabilitiesForOwner();
    assert.equal(middlewareAllowsPathForCapabilities(ownerCaps, '/settings'), true);
    assert.equal(middlewareAllowsPathForCapabilities(ownerCaps, '/checkout'), true);
    assert.equal(middlewareAllowsPathForCapabilities(ownerCaps, '/tables'), true);
    assert.equal(
      dashboardCapabilityMiddlewareRedirectPath(ownerCaps, '/tables', 'demo'),
      null,
    );
  });
});
