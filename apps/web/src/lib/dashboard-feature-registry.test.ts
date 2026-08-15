import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DASHBOARD_NAV_ITEMS,
  dashboardCapabilityMiddlewareRedirectPath,
  middlewareAllowsPathForCapabilities,
} from './dashboard-feature-registry';
import { capabilitiesFromKeys, toCapabilitiesPayload } from './permissions/can';
import { ROLE_TEMPLATES } from './permissions/role-templates';
import { buildDashboardTopNavItems, DASHBOARD_TOP_NAV_ORDER } from './dashboard-top-nav';
import { resolveCapabilitiesForOwner } from './permissions/resolve';

describe('middlewareAllowsPathForCapabilities', () => {
  it('aligns with preset capability sets', () => {
    const frontdeskCaps = capabilitiesFromKeys([...ROLE_TEMPLATES.frontdesk]);
    assert.equal(middlewareAllowsPathForCapabilities(frontdeskCaps, '/dashboard/guest-notice'), true);
    assert.equal(middlewareAllowsPathForCapabilities(frontdeskCaps, '/dashboard/settings'), false);

    const waiterCaps = capabilitiesFromKeys([...ROLE_TEMPLATES.waiter]);
    assert.equal(middlewareAllowsPathForCapabilities(waiterCaps, '/dashboard/waiter'), true);
    assert.equal(middlewareAllowsPathForCapabilities(waiterCaps, '/dashboard/checkout'), false);
  });

  it('owner star allows operational dashboard paths including tables', () => {
    const ownerCaps = resolveCapabilitiesForOwner();
    assert.equal(middlewareAllowsPathForCapabilities(ownerCaps, '/dashboard/settings'), true);
    assert.equal(middlewareAllowsPathForCapabilities(ownerCaps, '/dashboard/tables'), true);
    assert.equal(middlewareAllowsPathForCapabilities(ownerCaps, '/dashboard/checkout'), true);
    assert.equal(middlewareAllowsPathForCapabilities(ownerCaps, '/dashboard/waiter'), true);
    assert.equal(
      dashboardCapabilityMiddlewareRedirectPath(ownerCaps, '/dashboard/tables', 'demo'),
      null,
    );
  });
});

describe('buildDashboardTopNavItems owner star', () => {
  it('lists every capability-gated nav item plus kitchen for owner star in master order', () => {
    const items = buildDashboardTopNavItems({
      capabilities: toCapabilitiesPayload(resolveCapabilitiesForOwner()),
      restaurantSlug: 'demo',
    });
    assert.deepEqual(items.map((i) => i.id), [...DASHBOARD_TOP_NAV_ORDER]);
    for (const id of Object.keys(DASHBOARD_NAV_ITEMS)) {
      assert.ok(items.some((i) => i.id === id), `missing nav id ${id}`);
    }
  });
});
