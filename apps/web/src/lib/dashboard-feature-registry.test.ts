import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  middlewareAllowsOwnerPath,
  middlewareAllowsPathForCapabilities,
  OWNER_NAV_ITEM_IDS,
} from './dashboard-feature-registry';
import { capabilitiesFromKeys, toCapabilitiesPayload } from './permissions/can';
import { ROLE_TEMPLATES } from './permissions/role-templates';
import { buildDashboardTopNavItems } from './dashboard-top-nav';
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
});

describe('middlewareAllowsOwnerPath', () => {
  it('allows owner chrome paths only', () => {
    assert.equal(middlewareAllowsOwnerPath('/dashboard/settings'), true);
    assert.equal(middlewareAllowsOwnerPath('/dashboard/value-analytics'), true);
    assert.equal(middlewareAllowsOwnerPath('/dashboard/menu'), true);
    assert.equal(middlewareAllowsOwnerPath('/dashboard/checkout'), false);
  });
});

describe('buildDashboardTopNavItems owner chrome', () => {
  it('limits backend owner nav to owner chrome ids in OWNER_NAV order', () => {
    const items = buildDashboardTopNavItems({
      shellMode: 'owner',
      capabilities: toCapabilitiesPayload(resolveCapabilitiesForOwner()),
      restaurantSlug: 'demo',
      operationLogsHostEnabled: true,
    });
    assert.deepEqual(
      items.map((i) => i.id),
      [...OWNER_NAV_ITEM_IDS],
    );
  });
});
