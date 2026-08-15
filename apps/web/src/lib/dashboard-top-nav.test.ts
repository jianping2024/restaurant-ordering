import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DASHBOARD_NAV_ITEMS } from '@/lib/dashboard-feature-registry';
import {
  DASHBOARD_TOP_NAV_ORDER,
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
  topNavDesktopLinkClass,
  topNavMenuRowClass,
} from '@/lib/dashboard-top-nav';
import { toCapabilitiesPayload } from '@/lib/permissions/can';
import { capabilitiesFromKeys } from '@/lib/permissions/can';
import { resolveCapabilitiesForOwner } from '@/lib/permissions/resolve';
import { ROLE_TEMPLATES } from '@/lib/permissions/role-templates';

describe('DASHBOARD_TOP_NAV_ORDER', () => {
  it('is the sole master list: every registry nav id + kitchenBoard once', () => {
    const orderIds = [...DASHBOARD_TOP_NAV_ORDER];
    assert.equal(new Set(orderIds).size, orderIds.length);
    assert.deepEqual(
      orderIds.filter((id) => id === 'kitchenBoard'),
      ['kitchenBoard'],
    );
    const registryIds = Object.keys(DASHBOARD_NAV_ITEMS).sort();
    assert.deepEqual(
      orderIds.filter((id) => id !== 'kitchenBoard').sort(),
      registryIds,
    );
  });
});

describe('buildDashboardTopNavItems', () => {
  it('lists frontdesk nav in master order (capability filter)', () => {
    const items = buildDashboardTopNavItems({
      capabilities: toCapabilitiesPayload(capabilitiesFromKeys([...ROLE_TEMPLATES.frontdesk])),
      restaurantSlug: 'demo',
    });
    assert.deepEqual(items.map((item) => item.id), [
      'waiterBoard',
      'kitchenBoard',
      'checkout',
      'orders',
      'dishHistory',
      'guestNotice',
      'tables',
      'menu',
      'overview',
      'operationLogs',
    ]);
  });

  it('places kitchen in master order when board capability is present', () => {
    const items = buildDashboardTopNavItems({
      capabilities: toCapabilitiesPayload(capabilitiesFromKeys([...ROLE_TEMPLATES.frontdesk])),
      restaurantSlug: 'demo',
    });
    assert.equal(items[0]?.id, 'waiterBoard');
    assert.equal(items[1]?.id, 'kitchenBoard');
  });

  it('omits kitchen top-nav entry without board capability', () => {
    const items = buildDashboardTopNavItems({
      capabilities: toCapabilitiesPayload(capabilitiesFromKeys([...ROLE_TEMPLATES.cashier])),
      restaurantSlug: 'demo',
    });
    assert.equal(items.some((item) => item.id === 'kitchenBoard'), false);
  });

  it('keeps cashier relative order: waiter board then checkout', () => {
    const items = buildDashboardTopNavItems({
      capabilities: toCapabilitiesPayload(capabilitiesFromKeys([...ROLE_TEMPLATES.cashier])),
      restaurantSlug: 'demo',
    });
    assert.deepEqual(items.map((item) => item.id), ['waiterBoard', 'checkout']);
  });

  it('lists owner star nav in full master order', () => {
    const items = buildDashboardTopNavItems({
      capabilities: toCapabilitiesPayload(resolveCapabilitiesForOwner()),
      restaurantSlug: 'demo',
    });
    assert.deepEqual(items.map((item) => item.id), [...DASHBOARD_TOP_NAV_ORDER]);
  });

  it('lists owner-preset staff from capability template in master order', () => {
    const items = buildDashboardTopNavItems({
      capabilities: toCapabilitiesPayload(capabilitiesFromKeys([...ROLE_TEMPLATES.owner])),
      restaurantSlug: 'demo',
    });
    const ids = items.map((item) => item.id);
    assert.equal(ids.includes('guestNotice'), false);
    assert.ok(ids.includes('settings'));
    assert.ok(ids.includes('valueAnalytics'));
    assert.ok(ids.includes('abnormalOps'));
    assert.ok(ids.includes('waiterBoard'));
    assert.ok(ids.includes('checkout'));
    assert.ok(ids.includes('kitchenBoard'));
    // Filtered list stays a subsequence of the master order.
    let cursor = 0;
    for (const id of ids) {
      const at = DASHBOARD_TOP_NAV_ORDER.indexOf(id as (typeof DASHBOARD_TOP_NAV_ORDER)[number], cursor);
      assert.ok(at >= 0, `out of master order: ${id}`);
      cursor = at + 1;
    }
  });
});

describe('topNavDesktopScrollNavClassName', () => {
  it('uses mesa-chip-scroll + max-w-full bounded strip at lg without flex-1', () => {
    const className = topNavDesktopScrollNavClassName();
    assert.match(className, /mesa-chip-scroll/);
    assert.match(className, /max-w-full/);
    assert.match(className, /min-w-0/);
    assert.match(className, /lg:flex/);
    assert.doesNotMatch(className, /flex-1/);
  });
});

describe('topNavDesktopLinkClass / topNavMenuRowClass', () => {
  it('marks active desktop links with brand-ink + gold underline; idle is muted', () => {
    const active = topNavDesktopLinkClass(true);
    const idle = topNavDesktopLinkClass(false);
    assert.match(active, /text-brand-ink/);
    assert.match(active, /decoration-brand-gold/);
    assert.match(active, /font-medium/);
    assert.doesNotMatch(active, /text-brand-text[^-]/);
    assert.match(idle, /text-brand-text-muted/);
    assert.match(idle, /hover:text-brand-ink/);
  });

  it('marks active mobile rows with brand-ink; idle is muted', () => {
    const active = topNavMenuRowClass(true);
    const idle = topNavMenuRowClass(false);
    assert.match(active, /text-brand-ink/);
    assert.match(active, /border-brand-gold/);
    assert.match(idle, /text-brand-text-muted/);
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
