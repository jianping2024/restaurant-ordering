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
} from './dashboard-paths';
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

describe('isStaffRole', () => {
  it('accepts known staff roles only', () => {
    assert.equal(isStaffRole('kitchen'), true);
    assert.equal(isStaffRole('waiter'), true);
    assert.equal(isStaffRole('cashier'), true);
    assert.equal(isStaffRole('frontdesk'), true);
    assert.equal(isStaffRole('owner'), false);
    assert.equal(isStaffRole('print_agent'), false);
    assert.equal(isStaffRole(''), false);
  });
});

describe('dashboardMiddlewareRedirectPath', () => {
  it('redirects owner away from cashier checkout', () => {
    assert.equal(
      dashboardMiddlewareRedirectPath('owner', '/dashboard/checkout'),
      '/dashboard/settings',
    );
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
});
