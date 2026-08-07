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
  personalSettingsDropdownActionRowClass,
  personalSettingsDropdownRowClass,
  topNavAccountTriggerClass,
  topNavDesktopScrollNavClassName,
} from '@/lib/dashboard-top-nav';
import { toCapabilitiesPayload } from '@/lib/permissions/can';
import { capabilitiesFromKeys } from '@/lib/permissions/can';
import { ROLE_TEMPLATES } from '@/lib/permissions/role-templates';

describe('buildDashboardTopNavItems', () => {
  it('lists frontdesk nav from capability template', () => {
    const items = buildDashboardTopNavItems({
      shellMode: 'staff',
      capabilities: toCapabilitiesPayload(capabilitiesFromKeys([...ROLE_TEMPLATES.frontdesk])),
      restaurantSlug: 'demo',
    });
    assert.deepEqual(
      items.map((item) => item.id).sort(),
      [
        'checkout',
        'dishHistory',
        'guestNotice',
        'kitchenBoard',
        'menu',
        'orders',
        'overview',
        'tables',
        'waiterBoard',
      ].sort(),
    );
  });

  it('appends kitchen shortcut when capability is present', () => {
    const items = buildDashboardTopNavItems({
      shellMode: 'staff',
      capabilities: toCapabilitiesPayload(capabilitiesFromKeys([...ROLE_TEMPLATES.frontdesk])),
      restaurantSlug: 'demo',
    });
    assert.equal(items.some((item) => item.id === 'kitchenBoard'), true);
  });

  it('omits kitchen shortcut without capability', () => {
    const items = buildDashboardTopNavItems({
      shellMode: 'staff',
      capabilities: toCapabilitiesPayload(capabilitiesFromKeys([...ROLE_TEMPLATES.cashier])),
      restaurantSlug: 'demo',
    });
    assert.equal(items.some((item) => item.id === 'kitchenBoard'), false);
  });

  it('keeps cashier on waiter board + checkout only', () => {
    const items = buildDashboardTopNavItems({
      shellMode: 'staff',
      capabilities: toCapabilitiesPayload(capabilitiesFromKeys([...ROLE_TEMPLATES.cashier])),
      restaurantSlug: 'demo',
    });
    assert.deepEqual(items.map((item) => item.id).sort(), ['checkout', 'waiterBoard'].sort());
  });

  it('lists owner settings-focused items', () => {
    const items = buildDashboardTopNavItems({
      shellMode: 'owner',
      capabilities: '*',
      restaurantSlug: 'demo',
    });
    assert.deepEqual(
      items.map((item) => item.id).sort(),
      ['abnormalOps', 'overview', 'settings', 'valueAnalytics'].sort(),
    );
  });

  it('lists owner-preset staff from capability template', () => {
    const items = buildDashboardTopNavItems({
      shellMode: 'staff',
      capabilities: toCapabilitiesPayload(capabilitiesFromKeys([...ROLE_TEMPLATES.owner])),
      restaurantSlug: 'demo',
    });
    const ids = items.map((item) => item.id).sort();
    assert.ok(ids.includes('settings'));
    assert.ok(ids.includes('valueAnalytics'));
    assert.ok(ids.includes('abnormalOps'));
    assert.ok(ids.includes('waiterBoard'));
    assert.ok(ids.includes('checkout'));
    assert.ok(ids.includes('kitchenBoard'));
    assert.equal(ids.includes('guestNotice'), false);
  });
});

describe('topNavDesktopScrollNavClassName', () => {
  it('uses mesa-chip-scroll and lg breakpoint without flex-1 (brand is sole grower)', () => {
    const className = topNavDesktopScrollNavClassName();
    assert.match(className, /mesa-chip-scroll/);
    assert.match(className, /lg:flex/);
    assert.doesNotMatch(className, /flex-1/);
  });
});

describe('dashboardTopBarDesktopDropdownPanelClass', () => {
  it('aligns trailing menus to the anchor end edge', () => {
    assert.match(dashboardTopBarDesktopDropdownPanelClass('start'), /left-0/);
    assert.match(dashboardTopBarDesktopDropdownPanelClass('end'), /right-0/);
  });
});

describe('personal settings dropdown chrome', () => {
  it('uses single-line row classes for settings and actions', () => {
    assert.match(personalSettingsDropdownRowClass(), /justify-between/);
    assert.match(personalSettingsDropdownRowClass(), /min-h-11/);
    assert.match(personalSettingsDropdownActionRowClass(), /min-h-11/);
    assert.doesNotMatch(personalSettingsDropdownActionRowClass(), /justify-between/);
  });

  it('account trigger includes person icon spacing and desktop width relief', () => {
    const className = topNavAccountTriggerClass(false);
    assert.match(className, /gap-1/);
    assert.match(className, /sm:max-w-none/);
  });
});

describe('STAFF_TOP_BAR_COLLAPSED_NAV_MQ', () => {
  it('aligns with Tailwind lg breakpoint', () => {
    assert.equal(STAFF_TOP_BAR_COLLAPSED_NAV_MQ, '(max-width: 1023px)');
  });
});

describe('dashboardLogoHref', () => {
  it('routes from capabilities, not role enum', () => {
    const frontdeskCaps = toCapabilitiesPayload(capabilitiesFromKeys([...ROLE_TEMPLATES.frontdesk]));
    assert.equal(
      dashboardLogoHref('demo', frontdeskCaps),
      '/dashboard/waiter',
    );
    const overviewCaps = toCapabilitiesPayload(
      capabilitiesFromKeys(['dashboard.overview.view', 'floor.kitchen_board.view']),
    );
    assert.equal(dashboardLogoHref('demo', overviewCaps), '/dashboard');
  });
});

describe('isLogoHrefActive', () => {
  const overviewCaps = toCapabilitiesPayload(capabilitiesFromKeys(['dashboard.overview.view']));

  it('matches overview landing for capability set', () => {
    assert.equal(isLogoHrefActive('/dashboard', 'demo', overviewCaps), true);
    assert.equal(isLogoHrefActive('/dashboard/settings', 'demo', overviewCaps), false);
  });

  it('matches waiter board list and detail paths', () => {
    const waiterCaps = toCapabilitiesPayload(capabilitiesFromKeys([...ROLE_TEMPLATES.waiter]));
    assert.equal(isLogoHrefActive('/dashboard/waiter', 'demo', waiterCaps), true);
    assert.equal(isLogoHrefActive('/dashboard/waiter/table-1', 'demo', waiterCaps), true);
    const cashierCaps = toCapabilitiesPayload(capabilitiesFromKeys([...ROLE_TEMPLATES.cashier]));
    assert.equal(isLogoHrefActive('/dashboard/checkout', 'demo', cashierCaps), false);
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
