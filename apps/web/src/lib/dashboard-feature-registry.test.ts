import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CASHIER_NAV_PATHS,
  DASHBOARD_FEATURES,
  FRONTDESK_NAV_ITEM_IDS,
  FRONTDESK_NAV_PATHS,
  middlewareAllowsPath,
  navItemsForRole,
  navPathsForRole,
  OWNER_NAV_ITEM_IDS,
  OWNER_NAV_PATHS,
} from './dashboard-feature-registry';

describe('dashboard nav paths vs feature registry', () => {
  it('owner nav paths are registered for owner role', () => {
    for (const path of OWNER_NAV_PATHS) {
      const feature = DASHBOARD_FEATURES.find(
        (f) => f.path === path || path.startsWith(`${f.path}/`),
      );
      assert.ok(feature, `missing owner feature for nav path ${path}`);
      assert.ok(feature.navRoles.includes('owner'), `${path} must list owner in navRoles`);
    }
  });

  it('frontdesk nav paths are registered for frontdesk role', () => {
    for (const path of FRONTDESK_NAV_PATHS) {
      const feature = DASHBOARD_FEATURES.find(
        (f) => f.path === path || path.startsWith(`${f.path}/`),
      );
      assert.ok(feature, `missing frontdesk feature for nav path ${path}`);
      assert.ok(feature.navRoles.includes('frontdesk'), `${path} must list frontdesk in navRoles`);
    }
  });

  it('cashier nav paths are registered for cashier role', () => {
    for (const path of CASHIER_NAV_PATHS) {
      const feature = DASHBOARD_FEATURES.find((f) => f.path === path);
      assert.ok(feature, `missing cashier feature for nav path ${path}`);
      assert.ok(feature.navRoles.includes('cashier'), `${path} must list cashier in navRoles`);
    }
  });
});

describe('middlewareAllowsPath matches nav visibility', () => {
  it('each owner nav href passes owner middleware', () => {
    for (const path of OWNER_NAV_PATHS) {
      assert.equal(middlewareAllowsPath('owner', path), true, `owner blocked from ${path}`);
    }
  });

  it('each frontdesk nav href passes frontdesk middleware', () => {
    for (const path of FRONTDESK_NAV_PATHS) {
      assert.equal(middlewareAllowsPath('frontdesk', path), true, `frontdesk blocked from ${path}`);
    }
  });

  it('owner cannot reach frontdesk-only operational routes', () => {
    for (const path of ['/dashboard/menu', '/dashboard/tables', '/dashboard/checkout']) {
      assert.equal(middlewareAllowsPath('owner', path), false, `owner should not access ${path}`);
    }
  });

  it('frontdesk cannot reach settings', () => {
    assert.equal(middlewareAllowsPath('frontdesk', '/dashboard/settings'), false);
    assert.equal(middlewareAllowsPath('frontdesk', '/dashboard/settings/staff'), false);
  });

  it('cashier is limited to checkout', () => {
    assert.equal(middlewareAllowsPath('cashier', '/dashboard/checkout'), true);
    assert.equal(middlewareAllowsPath('cashier', '/dashboard/menu'), false);
    assert.equal(middlewareAllowsPath('cashier', '/dashboard'), false);
  });
});

describe('navPathsForRole', () => {
  it('returns expected arrays', () => {
    assert.deepEqual(navPathsForRole('owner'), OWNER_NAV_PATHS);
    assert.deepEqual(navPathsForRole('frontdesk'), FRONTDESK_NAV_PATHS);
    assert.deepEqual(navPathsForRole('cashier'), CASHIER_NAV_PATHS);
  });
});

describe('write pattern guardrails', () => {
  it('flags features still on client-rls writes', () => {
    const clientRls = DASHBOARD_FEATURES.filter((f) => f.writePattern === 'client-rls');
    assert.deepEqual(
      clientRls.map((f) => f.id),
      [],
      'dashboard writes should use server API, not client RLS',
    );
  });

  it('derives nav paths from registry nav item ids', () => {
    assert.equal(OWNER_NAV_PATHS.length, OWNER_NAV_ITEM_IDS.length);
    assert.equal(FRONTDESK_NAV_PATHS.length, FRONTDESK_NAV_ITEM_IDS.length);
    assert.equal(navItemsForRole('owner').length, OWNER_NAV_ITEM_IDS.length);
  });

  it('flags partial server-api features that need extra care when moving menus', () => {
    const partial = DASHBOARD_FEATURES.filter((f) => f.writePattern === 'server-api-partial');
    assert.ok(partial.some((f) => f.id === 'checkout'));
  });
});
