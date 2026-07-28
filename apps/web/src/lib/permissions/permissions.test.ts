import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { can, capabilitiesFromKeys } from '@/lib/permissions/can';
import {
  ALL_PERMISSION_KEYS,
  NAV_PERMISSION,
  DASHBOARD_ROUTE_PERMISSIONS,
  isPermissionKey,
} from '@/lib/permissions/registry';
import { ROLE_PRESET_KEYS, ROLE_TEMPLATES } from '@/lib/permissions/role-templates';
import {
  enforcePermissionRequires,
  floorBoardCapabilitiesFromCaps,
  mayForceCloseFromCaps,
  staffLandingPathFromCapabilities,
} from '@/lib/permissions/resolve';

describe('permissions registry integrity', () => {
  it('every ROLE_TEMPLATES key is registered', () => {
    const known = new Set(ALL_PERMISSION_KEYS);
    for (const preset of ROLE_PRESET_KEYS) {
      for (const key of ROLE_TEMPLATES[preset]) {
        assert.equal(known.has(key), true, `${preset}: ${key}`);
      }
    }
  });

  it('NAV_PERMISSION and ROUTE values are registered', () => {
    for (const key of Object.values(NAV_PERMISSION)) {
      assert.equal(isPermissionKey(key), true, key);
    }
    for (const row of DASHBOARD_ROUTE_PERMISSIONS) {
      assert.equal(isPermissionKey(row.permission), true, row.permission);
    }
  });
});

describe('can / resolve', () => {
  it('owner star allows all', () => {
    assert.equal(can('*', 'tables.force_close'), true);
  });

  it('set membership works', () => {
    const caps = capabilitiesFromKeys(['dashboard.checkout.view']);
    assert.equal(can(caps, 'dashboard.checkout.view'), true);
    assert.equal(can(caps, 'tables.force_close'), false);
  });

  it('enforcePermissionRequires adds deps', () => {
    const keys = enforcePermissionRequires(['settings.staff.manage']);
    assert.equal(keys.includes('dashboard.settings.view'), true);
  });

  it('floor caps derive from permissions only', () => {
    const waiter = floorBoardCapabilitiesFromCaps(
      capabilitiesFromKeys(['dashboard.waiter_board.view']),
    );
    assert.equal(waiter.canMenuDecrement, false);
    assert.equal(waiter.canCheckoutClose, false);

    const desk = floorBoardCapabilitiesFromCaps(
      capabilitiesFromKeys([
        'orders.menu_decrement',
        'tables.checkout_close',
        'checkout.assist_bill',
        'checkout.open_pending_tables',
        'checkout.print_pre_bill',
      ]),
    );
    assert.equal(desk.canMenuDecrement, true);
    assert.equal(desk.canPrintSessionPreBill, true);
  });

  it('force close from caps', () => {
    assert.equal(mayForceCloseFromCaps('*'), true);
    assert.equal(mayForceCloseFromCaps(capabilitiesFromKeys(['tables.force_close'])), true);
    assert.equal(mayForceCloseFromCaps(capabilitiesFromKeys(['tables.checkout_close'])), false);
  });

  it('landing prefers waiter board then checkout', () => {
    assert.equal(
      staffLandingPathFromCapabilities('demo', capabilitiesFromKeys(['dashboard.checkout.view'])),
      '/dashboard/checkout',
    );
    assert.equal(
      staffLandingPathFromCapabilities(
        'demo',
        capabilitiesFromKeys(['floor.kitchen_board.view']),
      ),
      '/demo/kitchen',
    );
  });
});
