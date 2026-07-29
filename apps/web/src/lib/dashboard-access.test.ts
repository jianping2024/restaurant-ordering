import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  dashboardMiddlewareRedirectPath,
  isCashierCheckoutPath,
  isCashierOperationalPath,
  isDashboardSettingsPath,
  isDashboardWaiterBoardPath,
  isFrontdeskOperationalPath,
  isOwnerDashboardPath,
  isOwnerOperationalPath,
  isWaiterOperationalPath,
  shouldPrefetchDashboardNav,
} from './dashboard-paths';
import { resolveDashboardOperationalContext } from './dashboard-operational-context';
import { capabilitiesFromKeys } from './permissions/can';
import { resolveCapabilitiesForOwner } from './permissions/resolve';
import { isStaffRole } from './staff-account';

describe('isDashboardSettingsPath', () => {
  it('matches settings root and nested routes', () => {
    assert.equal(isDashboardSettingsPath('/dashboard/settings'), true);
    assert.equal(isDashboardSettingsPath('/dashboard/settings/staff'), true);
    assert.equal(isDashboardSettingsPath('/dashboard/checkout'), false);
  });
});

describe('isOwnerDashboardPath', () => {
  it('allows settings and abnormal operations for owner', () => {
    assert.equal(isOwnerDashboardPath('/dashboard/settings'), true);
    assert.equal(isOwnerDashboardPath('/dashboard/settings/staff'), true);
    assert.equal(isOwnerDashboardPath('/dashboard/abnormal-operations'), true);
    assert.equal(isOwnerDashboardPath('/dashboard/value-analytics'), true);
    assert.equal(isOwnerOperationalPath('/dashboard/abnormal-operations'), true);
    assert.equal(isOwnerOperationalPath('/dashboard/guest-notice'), false);
    assert.equal(isOwnerDashboardPath('/dashboard/guest-notice'), false);
    assert.equal(isOwnerDashboardPath('/dashboard'), true);
    assert.equal(isOwnerDashboardPath('/dashboard/checkout'), false);
  });
});

describe('isCashierCheckoutPath', () => {
  it('matches checkout routes only', () => {
    assert.equal(isCashierCheckoutPath('/dashboard/checkout'), true);
    assert.equal(isCashierCheckoutPath('/dashboard/checkout/foo'), true);
    assert.equal(isCashierCheckoutPath('/dashboard/orders'), false);
  });
});

describe('isCashierOperationalPath', () => {
  it('matches waiter board and checkout routes only', () => {
    assert.equal(isCashierOperationalPath('/dashboard/waiter'), true);
    assert.equal(isCashierOperationalPath('/dashboard/waiter/table-1'), true);
    assert.equal(isCashierOperationalPath('/dashboard/checkout'), true);
    assert.equal(isCashierOperationalPath('/dashboard/orders'), false);
    assert.equal(isDashboardWaiterBoardPath('/dashboard/waiter/foo'), true);
  });
});

describe('isFrontdeskOperationalPath', () => {
  it('allows operational dashboard routes except settings', () => {
    assert.equal(isFrontdeskOperationalPath('/dashboard'), true);
    assert.equal(isFrontdeskOperationalPath('/dashboard/tables'), true);
    assert.equal(isFrontdeskOperationalPath('/dashboard/menu'), true);
    assert.equal(isFrontdeskOperationalPath('/dashboard/waiter'), true);
    assert.equal(isFrontdeskOperationalPath('/dashboard/settings'), false);
    assert.equal(isFrontdeskOperationalPath('/dashboard/settings/menu'), false);
    assert.equal(isFrontdeskOperationalPath('/auth/login'), false);
  });
});

describe('isWaiterOperationalPath', () => {
  it('matches waiter board only', () => {
    assert.equal(isWaiterOperationalPath('/dashboard/waiter'), true);
    assert.equal(isWaiterOperationalPath('/dashboard/waiter/t1'), true);
    assert.equal(isWaiterOperationalPath('/dashboard/checkout'), false);
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
    assert.equal(shouldPrefetchDashboardNav('/dashboard/settings'), true);
    assert.equal(shouldPrefetchDashboardNav('/dashboard/settings/staff'), true);
    assert.equal(shouldPrefetchDashboardNav('/dashboard/settings/features'), true);
    assert.equal(shouldPrefetchDashboardNav('/dashboard/settings/buffet'), false);
    assert.equal(shouldPrefetchDashboardNav('/dashboard/settings/print-assistant'), false);
    assert.equal(shouldPrefetchDashboardNav('/dashboard/value-analytics'), false);
    assert.equal(shouldPrefetchDashboardNav('/dashboard/tables'), true);
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
        { mode: 'owner', restaurant: restaurant as never },
        resolveCapabilitiesForOwner(),
        'dashboard.overview.view',
      ),
      { restaurantId: 'r1' },
    );
    assert.deepEqual(
      resolveDashboardOperationalContext(
        { mode: 'store_owner', restaurant },
        overviewCaps,
        'dashboard.overview.view',
      ),
      { restaurantId: 'r1' },
    );
    assert.deepEqual(
      resolveDashboardOperationalContext(
        { mode: 'frontdesk', restaurant },
        overviewCaps,
        'dashboard.overview.view',
      ),
      { restaurantId: 'r1' },
    );
  });

  it('rejects missing capability even for frontdesk mode', () => {
    assert.deepEqual(
      resolveDashboardOperationalContext(
        { mode: 'frontdesk', restaurant },
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

  it('allows cashier when capability is granted', () => {
    assert.deepEqual(
      resolveDashboardOperationalContext(
        {
          mode: 'cashier',
          restaurant: { id: 'r1', name: 'Test', slug: 'test', buffet_service_mode: 'classic' },
        },
        overviewCaps,
        'dashboard.overview.view',
      ),
      { restaurantId: 'r1' },
    );
  });

  it('blocks writable context when restaurant is suspended', () => {
    assert.deepEqual(
      resolveDashboardOperationalContext(
        { mode: 'store_owner', restaurant: { ...restaurant, suspended_at: '2026-01-01T00:00:00Z' } },
        overviewCaps,
        'dashboard.overview.view',
        { requireWritable: true },
      ),
      { error: 'restaurant_suspended', status: 403 },
    );
  });
});

describe('dashboardMiddlewareRedirectPath', () => {
  it('redirects owner away from cashier checkout', () => {
    assert.equal(
      dashboardMiddlewareRedirectPath('owner', '/dashboard/checkout'),
      '/dashboard/settings',
    );
  });

  it('allows store_owner on owner tools and operational routes', () => {
    assert.equal(dashboardMiddlewareRedirectPath('store_owner', '/dashboard/value-analytics'), null);
    assert.equal(
      dashboardMiddlewareRedirectPath('store_owner', '/dashboard/abnormal-operations'),
      null,
    );
    assert.equal(dashboardMiddlewareRedirectPath('store_owner', '/dashboard/settings'), null);
    assert.equal(dashboardMiddlewareRedirectPath('store_owner', '/dashboard/settings/staff'), null);
    assert.equal(dashboardMiddlewareRedirectPath('store_owner', '/dashboard/waiter'), null);
  });

  it('redirects frontdesk away from settings', () => {
    assert.equal(
      dashboardMiddlewareRedirectPath('frontdesk', '/dashboard/settings'),
      '/dashboard',
    );
  });

  it('redirects cashier from overview to waiter board', () => {
    assert.equal(dashboardMiddlewareRedirectPath('cashier', '/dashboard'), '/dashboard/waiter');
  });

  it('redirects cashier away from admin pages', () => {
    assert.equal(dashboardMiddlewareRedirectPath('cashier', '/dashboard/menu'), '/dashboard/waiter');
  });

  it('allows cashier on waiter board and checkout', () => {
    assert.equal(dashboardMiddlewareRedirectPath('cashier', '/dashboard/waiter'), null);
    assert.equal(dashboardMiddlewareRedirectPath('cashier', '/dashboard/checkout'), null);
  });

  it('allows frontdesk on operational routes', () => {
    assert.equal(dashboardMiddlewareRedirectPath('frontdesk', '/dashboard/waiter'), null);
  });

  it('keeps waiter on board only', () => {
    assert.equal(dashboardMiddlewareRedirectPath('waiter', '/dashboard'), '/dashboard/waiter');
    assert.equal(dashboardMiddlewareRedirectPath('waiter', '/dashboard/checkout'), '/dashboard/waiter');
    assert.equal(dashboardMiddlewareRedirectPath('waiter', '/dashboard/waiter'), null);
    assert.equal(dashboardMiddlewareRedirectPath('waiter', '/dashboard/waiter/t1'), null);
  });
});
