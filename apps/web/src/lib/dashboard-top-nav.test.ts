import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildDashboardTopNavPresentation,
  dashboardLogoHref,
  dashboardWaiterTableIdFromPath,
  isDashboardWaiterTableDetailPath,
  isNavItemActive,
} from '@/lib/dashboard-top-nav';

describe('buildDashboardTopNavPresentation', () => {
  it('splits frontdesk nav into primary waiter board + checkout and overflow items', () => {
    const { primary, overflow } = buildDashboardTopNavPresentation({
      accessMode: 'frontdesk',
      restaurantSlug: 'demo',
      kitchenShortcutEnabled: false,
    });
    assert.deepEqual(
      primary.map((item) => item.id),
      ['waiterBoard', 'checkout'],
    );
    assert.deepEqual(
      overflow.map((item) => item.id),
      ['orders', 'overview', 'tables', 'menu'],
    );
  });

  it('puts kitchen shortcut in frontdesk overflow when enabled', () => {
    const { overflow } = buildDashboardTopNavPresentation({
      accessMode: 'frontdesk',
      restaurantSlug: 'demo',
      kitchenShortcutEnabled: true,
    });
    assert.equal(overflow.some((item) => item.id === 'kitchenBoard'), true);
  });

  it('keeps cashier on waiter board + checkout with no overflow', () => {
    const { primary, overflow } = buildDashboardTopNavPresentation({
      accessMode: 'cashier',
      restaurantSlug: 'demo',
      kitchenShortcutEnabled: true,
    });
    assert.deepEqual(primary.map((item) => item.id), ['waiterBoard', 'checkout']);
    assert.equal(overflow.length, 0);
  });

  it('keeps owner overview primary and analytics/abnormal in overflow', () => {
    const { primary, overflow } = buildDashboardTopNavPresentation({
      accessMode: 'owner',
      restaurantSlug: 'demo',
      kitchenShortcutEnabled: false,
    });
    assert.deepEqual(primary.map((item) => item.id), ['overview']);
    assert.deepEqual(
      overflow.map((item) => item.id),
      ['valueAnalytics', 'abnormalOps', 'settings'],
    );
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
