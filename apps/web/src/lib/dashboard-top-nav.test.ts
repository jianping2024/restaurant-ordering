import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  STAFF_TOP_BAR_COLLAPSED_NAV_MQ,
  buildDashboardTopNavItems,
  dashboardLogoHref,
  dashboardWaiterTableIdFromPath,
  isDashboardWaiterTableDetailPath,
  isLogoHrefActive,
  isNavItemActive,
  dashboardTopBarDesktopDropdownPanelClass,
  isTopBarLogoHrefActive,
  topNavDesktopScrollNavClassName,
} from '@/lib/dashboard-top-nav';

describe('buildDashboardTopNavItems', () => {
  it('lists frontdesk nav items including operational shortcuts', () => {
    const items = buildDashboardTopNavItems({
      accessMode: 'frontdesk',
      restaurantSlug: 'demo',
      kitchenShortcutEnabled: false,
    });
    assert.deepEqual(
      items.map((item) => item.id),
      ['waiterBoard', 'checkout', 'orders', 'overview', 'tables', 'menu', 'guestNotice'],
    );
  });

  it('appends kitchen shortcut for frontdesk when enabled', () => {
    const items = buildDashboardTopNavItems({
      accessMode: 'frontdesk',
      restaurantSlug: 'demo',
      kitchenShortcutEnabled: true,
    });
    assert.equal(items.some((item) => item.id === 'kitchenBoard'), true);
  });

  it('keeps cashier on waiter board + checkout only', () => {
    const items = buildDashboardTopNavItems({
      accessMode: 'cashier',
      restaurantSlug: 'demo',
      kitchenShortcutEnabled: true,
    });
    assert.deepEqual(items.map((item) => item.id), ['waiterBoard', 'checkout']);
  });

  it('lists owner items', () => {
    const items = buildDashboardTopNavItems({
      accessMode: 'owner',
      restaurantSlug: 'demo',
      kitchenShortcutEnabled: false,
    });
    assert.deepEqual(
      items.map((item) => item.id),
      ['overview', 'valueAnalytics', 'abnormalOps', 'guestNotice', 'settings'],
    );
  });
});

describe('topNavDesktopScrollNavClassName', () => {
  it('uses mesa-chip-scroll and lg breakpoint', () => {
    const className = topNavDesktopScrollNavClassName();
    assert.match(className, /mesa-chip-scroll/);
    assert.match(className, /lg:flex/);
    assert.match(className, /flex-1/);
  });
});

describe('dashboardTopBarDesktopDropdownPanelClass', () => {
  it('aligns trailing menus to the anchor end edge', () => {
    assert.match(dashboardTopBarDesktopDropdownPanelClass('start'), /left-0/);
    assert.match(dashboardTopBarDesktopDropdownPanelClass('end'), /right-0/);
  });
});

describe('STAFF_TOP_BAR_COLLAPSED_NAV_MQ', () => {
  it('aligns with Tailwind lg breakpoint', () => {
    assert.equal(STAFF_TOP_BAR_COLLAPSED_NAV_MQ, '(max-width: 1023px)');
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

describe('isTopBarLogoHrefActive', () => {
  it('matches slug waiter shell paths', () => {
    assert.equal(isTopBarLogoHrefActive('/demo/waiter', '/demo/waiter'), true);
    assert.equal(isTopBarLogoHrefActive('/demo/waiter/table-1', '/demo/waiter'), true);
    assert.equal(isTopBarLogoHrefActive('/demo/kitchen', '/demo/waiter'), false);
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
