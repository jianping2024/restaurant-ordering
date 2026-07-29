import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CASHIER_NAV_PATHS,
  DASHBOARD_FEATURES,
  FRONTDESK_NAV_PATHS,
  middlewareAllowsPath,
  navItemIdsFromPermissionKeys,
  navItemsForRole,
  navPathsForRole,
  OWNER_NAV_ITEM_IDS,
  OWNER_NAV_PATHS,
  STORE_OWNER_NAV_PATHS,
  WAITER_NAV_PATHS,
} from './dashboard-feature-registry';
import { ROLE_TEMPLATES } from '@/lib/permissions/role-templates';

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

  it('store_owner default nav is not the frontdesk list', () => {
    assert.notDeepEqual(STORE_OWNER_NAV_PATHS, FRONTDESK_NAV_PATHS);
    assert.ok(STORE_OWNER_NAV_PATHS.includes('/dashboard/settings'));
    assert.ok(STORE_OWNER_NAV_PATHS.includes('/dashboard/value-analytics'));
    assert.ok(STORE_OWNER_NAV_PATHS.includes('/dashboard/abnormal-operations'));
    assert.ok(STORE_OWNER_NAV_PATHS.includes('/dashboard/waiter'));
    assert.equal(STORE_OWNER_NAV_PATHS.includes('/dashboard/guest-notice'), false);
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

  it('store_owner shell allows settings and floor ops', () => {
    assert.equal(middlewareAllowsPath('store_owner', '/dashboard/settings'), true);
    assert.equal(middlewareAllowsPath('store_owner', '/dashboard/value-analytics'), true);
    assert.equal(middlewareAllowsPath('store_owner', '/dashboard/abnormal-operations'), true);
    assert.equal(middlewareAllowsPath('store_owner', '/dashboard/waiter'), true);
    assert.equal(middlewareAllowsPath('store_owner', '/dashboard/menu'), true);
  });

  it('owner cannot reach guest notice (frontdesk capability by default)', () => {
    assert.equal(middlewareAllowsPath('owner', '/dashboard/guest-notice'), false);
  });

  it('frontdesk can reach guest notice settings path shell', () => {
    assert.equal(middlewareAllowsPath('frontdesk', '/dashboard/guest-notice'), true);
  });

  it('cashier cannot reach guest notice settings', () => {
    assert.equal(middlewareAllowsPath('cashier', '/dashboard/guest-notice'), false);
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

  it('cashier may access waiter board and checkout only', () => {
    assert.equal(middlewareAllowsPath('cashier', '/dashboard/waiter'), true);
    assert.equal(middlewareAllowsPath('cashier', '/dashboard/waiter/table-1'), true);
    assert.equal(middlewareAllowsPath('cashier', '/dashboard/checkout'), true);
    assert.equal(middlewareAllowsPath('cashier', '/dashboard/menu'), false);
    assert.equal(middlewareAllowsPath('cashier', '/dashboard/orders'), false);
    assert.equal(middlewareAllowsPath('cashier', '/dashboard/tables'), false);
    assert.equal(middlewareAllowsPath('cashier', '/dashboard'), false);
  });

  it('waiter may access waiter board only', () => {
    assert.equal(middlewareAllowsPath('waiter', '/dashboard/waiter'), true);
    assert.equal(middlewareAllowsPath('waiter', '/dashboard/waiter/table-1'), true);
    assert.equal(middlewareAllowsPath('waiter', '/dashboard/checkout'), false);
    assert.equal(middlewareAllowsPath('waiter', '/dashboard/menu'), false);
  });
});

describe('navPathsForRole', () => {
  it('maps modes from templates (store_owner ≠ frontdesk)', () => {
    assert.deepEqual(navPathsForRole('owner'), OWNER_NAV_PATHS);
    assert.deepEqual(navPathsForRole('frontdesk'), FRONTDESK_NAV_PATHS);
    assert.deepEqual(navPathsForRole('store_owner'), STORE_OWNER_NAV_PATHS);
    assert.deepEqual(navPathsForRole('cashier'), CASHIER_NAV_PATHS);
    assert.deepEqual(navPathsForRole('waiter'), WAITER_NAV_PATHS);
  });
});

describe('navItemIdsFromPermissionKeys', () => {
  it('derives frontdesk and owner-preset ids from ROLE_TEMPLATES', () => {
    assert.deepEqual(
      navItemIdsFromPermissionKeys(ROLE_TEMPLATES.frontdesk).sort(),
      navItemsForRole('frontdesk')
        .map((item) => item.id)
        .sort(),
    );
    assert.deepEqual(
      navItemIdsFromPermissionKeys(ROLE_TEMPLATES.owner).sort(),
      navItemsForRole('store_owner')
        .map((item) => item.id)
        .sort(),
    );
  });

  it('owner chrome list stays settings-focused', () => {
    assert.equal(navItemsForRole('owner').length, OWNER_NAV_ITEM_IDS.length);
    assert.deepEqual(
      navItemsForRole('owner').map((item) => item.id),
      [...OWNER_NAV_ITEM_IDS],
    );
  });
});
