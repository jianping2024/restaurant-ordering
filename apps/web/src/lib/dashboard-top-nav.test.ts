import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildDashboardTopNavPresentation,
  buildDashboardTopNavItems,
  dashboardLogoHref,
  dashboardWaiterTableIdFromPath,
  isDashboardWaiterTableDetailPath,
  isLogoHrefActive,
  isNavItemActive,
} from '@/lib/dashboard-top-nav';
import {
  buildStaffPersonalTopNavPresentation,
  isStaffLogoHrefActive,
} from '@/lib/staff-personal-top-nav';

describe('buildDashboardTopNavPresentation', () => {
  it('keeps frontdesk checkout as the only mobile quick action', () => {
    const { items, quickActions } = buildDashboardTopNavPresentation({
      accessMode: 'frontdesk',
      restaurantSlug: 'demo',
      kitchenShortcutEnabled: false,
    });
    assert.deepEqual(
      items.map((item) => item.id),
      ['waiterBoard', 'checkout', 'orders', 'overview', 'tables', 'menu', 'guestNotice'],
    );
    assert.deepEqual(quickActions.map((item) => item.id), ['checkout']);
  });

  it('puts kitchen shortcut in items but not quick actions when enabled', () => {
    const { items, quickActions } = buildDashboardTopNavPresentation({
      accessMode: 'frontdesk',
      restaurantSlug: 'demo',
      kitchenShortcutEnabled: true,
    });
    assert.equal(items.some((item) => item.id === 'kitchenBoard'), true);
    assert.equal(quickActions.some((item) => item.id === 'kitchenBoard'), false);
  });

  it('keeps cashier on waiter board + checkout with checkout only promoted', () => {
    const { items, quickActions } = buildDashboardTopNavPresentation({
      accessMode: 'cashier',
      restaurantSlug: 'demo',
      kitchenShortcutEnabled: true,
    });
    assert.deepEqual(items.map((item) => item.id), ['waiterBoard', 'checkout']);
    assert.deepEqual(quickActions.map((item) => item.id), ['checkout']);
  });

  it('keeps owner items complete with no quick actions because logo is home', () => {
    const { items, quickActions } = buildDashboardTopNavPresentation({
      accessMode: 'owner',
      restaurantSlug: 'demo',
      kitchenShortcutEnabled: false,
    });
    assert.deepEqual(
      items.map((item) => item.id),
      ['overview', 'valueAnalytics', 'abnormalOps', 'guestNotice', 'settings'],
    );
    assert.equal(quickActions.length, 0);
  });

  it('excludes logo home targets from quick actions for floor roles', () => {
    const { quickActions } = buildDashboardTopNavPresentation({
      accessMode: 'waiter',
      restaurantSlug: 'demo',
      kitchenShortcutEnabled: false,
    });
    assert.equal(quickActions.length, 0);
    assert.equal(dashboardLogoHref('waiter'), '/dashboard/waiter');
  });
});

describe('buildStaffPersonalTopNavPresentation', () => {
  it('drops nav items that duplicate the logo href', () => {
    const href = '/demo/waiter';
    const { items, quickActions } = buildStaffPersonalTopNavPresentation(
      [
        {
          id: 'waiterBoard',
          href,
          labelKey: 'viewWaiter',
          icon: '🛎️',
          matchPrefix: href,
        },
      ],
      href,
    );
    assert.equal(items.length, 1);
    assert.equal(quickActions.length, 0);
  });
});

describe('dashboardLogoHref', () => {
  it('routes frontdesk logo to waiter board', () => {
    assert.equal(dashboardLogoHref('frontdesk'), '/dashboard/waiter');
  });

  it('routes cashier logo to waiter board', () => {
    assert.equal(dashboardLogoHref('cashier'), '/dashboard/waiter');
  });

  it('routes waiter logo to waiter board', () => {
    assert.equal(dashboardLogoHref('waiter'), '/dashboard/waiter');
  });
});

describe('isLogoHrefActive', () => {
  it('matches owner overview exactly', () => {
    assert.equal(isLogoHrefActive('/dashboard', 'owner'), true);
    assert.equal(isLogoHrefActive('/dashboard/settings', 'owner'), false);
  });

  it('matches waiter board list and detail paths', () => {
    assert.equal(isLogoHrefActive('/dashboard/waiter', 'waiter'), true);
    assert.equal(isLogoHrefActive('/dashboard/waiter/table-1', 'frontdesk'), true);
    assert.equal(isLogoHrefActive('/dashboard/checkout', 'cashier'), false);
  });
});

describe('isStaffLogoHrefActive', () => {
  it('matches slug waiter shell paths', () => {
    assert.equal(isStaffLogoHrefActive('/demo/waiter', '/demo/waiter'), true);
    assert.equal(isStaffLogoHrefActive('/demo/waiter/table-1', '/demo/waiter'), true);
  });
});

describe('isNavItemActive', () => {
  it('matches waiter board detail under matchPrefix', () => {
    assert.equal(
      isNavItemActive('/dashboard/waiter/table-1', {
        href: '/dashboard/waiter',
        matchPrefix: '/dashboard/waiter',
      }),
      true,
    );
  });
});

describe('buildDashboardTopNavItems', () => {
  it('appends kitchen shortcut for frontdesk when enabled', () => {
    const items = buildDashboardTopNavItems({
      accessMode: 'frontdesk',
      restaurantSlug: 'demo',
      kitchenShortcutEnabled: true,
    });
    assert.equal(items.some((item) => item.id === 'kitchenBoard'), true);
  });
});

describe('dashboardWaiterTableIdFromPath', () => {
  const tableId = '2db46804-d02a-4227-8193-1e061768938d';

  it('parses uuid from detail path', () => {
    assert.equal(dashboardWaiterTableIdFromPath(`/dashboard/waiter/${tableId}`), tableId);
  });

  it('returns null for board list and invalid ids', () => {
    assert.equal(dashboardWaiterTableIdFromPath('/dashboard/waiter'), null);
    assert.equal(dashboardWaiterTableIdFromPath('/dashboard/waiter/not-a-uuid'), null);
    assert.equal(isDashboardWaiterTableDetailPath(`/dashboard/waiter/${tableId}`), true);
  });
});
