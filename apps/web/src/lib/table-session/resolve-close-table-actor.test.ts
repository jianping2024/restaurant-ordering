import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { capabilitiesFromKeys } from '../permissions/can';
import type { PrincipalWithCapabilities } from '../permissions/principal';
import {
  resolveCloseTableSessionDeskActor,
  settledCloseReasonForStaffPreset,
} from './resolve-close-table-actor';

const restaurant = {
  id: '88064a0b-1d36-4633-aa21-c928039e4f57',
  name: '白云',
  slug: 'restaurant-mohnrib5',
  logo_url: null,
  feature_flags: {},
  buffet_service_mode: 'classic' as const,
  suspended_at: null,
  suspension_reason: null,
};

function staffPrincipal(presetKey: 'owner' | 'frontdesk' | 'cashier' | 'waiter'): PrincipalWithCapabilities {
  return {
    principal: {
      kind: 'staff',
      restaurantId: restaurant.id,
      userId: 'user-1',
      staffAccountId: 'staff-1',
      roleId: 'role-1',
      roleName: presetKey,
      presetKey,
      staffRoleLabel: presetKey,
    },
    capabilities: capabilitiesFromKeys([
      'tables.checkout_close',
      'tables.force_close',
      'dashboard.waiter_board.view',
    ]),
  };
}

describe('settledCloseReasonForStaffPreset', () => {
  it('maps presets to settled closed reasons', () => {
    assert.equal(settledCloseReasonForStaffPreset('cashier'), 'cashier_closed');
    assert.equal(settledCloseReasonForStaffPreset('owner'), 'owner_closed');
    assert.equal(settledCloseReasonForStaffPreset('frontdesk'), 'frontdesk_closed');
  });
});

describe('resolveCloseTableSessionDeskActor', () => {
  it('allows store_owner with tables.checkout_close', () => {
    const decision = resolveCloseTableSessionDeskActor(
      { mode: 'store_owner', restaurant },
      staffPrincipal('owner'),
      'checkout_close',
    );
    assert.equal(decision.ok, true);
    if (decision.ok) {
      assert.equal(decision.closedReason, 'owner_closed');
      assert.equal(decision.staffRole, 'owner');
    }
  });

  it('allows frontdesk with tables.checkout_close', () => {
    const decision = resolveCloseTableSessionDeskActor(
      { mode: 'frontdesk', restaurant },
      staffPrincipal('frontdesk'),
      'checkout_close',
    );
    assert.equal(decision.ok, true);
  });

  it('allows cashier with tables.checkout_close', () => {
    const loaded = staffPrincipal('cashier');
    const decision = resolveCloseTableSessionDeskActor(
      {
        mode: 'cashier',
        restaurant: {
          id: restaurant.id,
          name: restaurant.name,
          slug: restaurant.slug,
          buffet_service_mode: 'classic',
        },
      },
      loaded,
      'checkout_close',
    );
    assert.equal(decision.ok, true);
    if (decision.ok) {
      assert.equal(decision.closedReason, 'cashier_closed');
    }
  });

  it('rejects waiter without checkout_close capability', () => {
    const loaded: PrincipalWithCapabilities = {
      principal: {
        kind: 'staff',
        restaurantId: restaurant.id,
        userId: 'user-w',
        staffAccountId: 'staff-w',
        roleId: 'role-w',
        roleName: 'waiter',
        presetKey: 'waiter',
        staffRoleLabel: 'waiter',
      },
      capabilities: capabilitiesFromKeys(['floor.waiter_board.view']),
    };
    const decision = resolveCloseTableSessionDeskActor(
      {
        mode: 'waiter',
        restaurant: {
          id: restaurant.id,
          name: restaurant.name,
          slug: restaurant.slug,
          buffet_service_mode: 'classic',
        },
      },
      loaded,
      'checkout_close',
    );
    assert.equal(decision.ok, false);
    if (!decision.ok) {
      assert.equal(decision.status, 403);
    }
  });

  it('allows manual gate with tables.force_close only', () => {
    const loaded: PrincipalWithCapabilities = {
      principal: {
        kind: 'staff',
        restaurantId: restaurant.id,
        userId: 'user-o',
        staffAccountId: 'staff-o',
        roleId: 'role-o',
        roleName: 'owner',
        presetKey: 'owner',
        staffRoleLabel: 'owner',
      },
      capabilities: capabilitiesFromKeys(['tables.force_close']),
    };
    const decision = resolveCloseTableSessionDeskActor(
      { mode: 'store_owner', restaurant },
      loaded,
      'manual',
    );
    assert.equal(decision.ok, true);
    if (decision.ok) {
      assert.equal(decision.closedReason, 'owner_closed');
    }
  });

  it('rejects manual gate with only tables.checkout_close', () => {
    const loaded: PrincipalWithCapabilities = {
      principal: {
        kind: 'staff',
        restaurantId: restaurant.id,
        userId: 'user-c',
        staffAccountId: 'staff-c',
        roleId: 'role-c',
        roleName: 'cashier',
        presetKey: 'cashier',
        staffRoleLabel: 'cashier',
      },
      capabilities: capabilitiesFromKeys(['tables.checkout_close']),
    };
    const decision = resolveCloseTableSessionDeskActor(
      {
        mode: 'cashier',
        restaurant: {
          id: restaurant.id,
          name: restaurant.name,
          slug: restaurant.slug,
          buffet_service_mode: 'classic',
        },
      },
      loaded,
      'manual',
    );
    assert.equal(decision.ok, false);
  });

  it('allows waiter mode when force_close capability is present', () => {
    const loaded: PrincipalWithCapabilities = {
      principal: {
        kind: 'staff',
        restaurantId: restaurant.id,
        userId: 'user-w',
        staffAccountId: 'staff-w',
        roleId: 'role-w',
        roleName: 'waiter',
        presetKey: 'waiter',
        staffRoleLabel: 'waiter',
      },
      capabilities: capabilitiesFromKeys(['tables.force_close']),
    };
    const decision = resolveCloseTableSessionDeskActor(
      {
        mode: 'waiter',
        restaurant: {
          id: restaurant.id,
          name: restaurant.name,
          slug: restaurant.slug,
          buffet_service_mode: 'classic',
        },
      },
      loaded,
      'manual',
    );
    assert.equal(decision.ok, true);
  });

  it('rejects checkout_close gate without tables.checkout_close', () => {
    const loaded: PrincipalWithCapabilities = {
      principal: {
        kind: 'staff',
        restaurantId: restaurant.id,
        userId: 'user-o',
        staffAccountId: 'staff-o',
        roleId: 'role-o',
        roleName: 'owner',
        presetKey: 'owner',
        staffRoleLabel: 'owner',
      },
      capabilities: capabilitiesFromKeys(['tables.force_close']),
    };
    const decision = resolveCloseTableSessionDeskActor(
      { mode: 'store_owner', restaurant },
      loaded,
      'checkout_close',
    );
    assert.equal(decision.ok, false);
  });
});
