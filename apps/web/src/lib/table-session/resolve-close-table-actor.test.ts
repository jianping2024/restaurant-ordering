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

describe('settledCloseReasonForStaffPreset', () => {
  it('maps presets to settled closed reasons', () => {
    assert.equal(settledCloseReasonForStaffPreset('cashier'), 'cashier_closed');
    assert.equal(settledCloseReasonForStaffPreset('owner'), 'owner_closed');
    assert.equal(settledCloseReasonForStaffPreset('frontdesk'), 'frontdesk_closed');
  });
});

describe('resolveCloseTableSessionDeskActor', () => {
  it('rejects waiter without force_close capability', () => {
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
      capabilities: capabilitiesFromKeys(['dashboard.waiter_board.view']),
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
    );
    assert.equal(decision.ok, false);
    if (!decision.ok) {
      assert.equal(decision.status, 403);
    }
  });

  it('allows owner with tables.force_close only', () => {
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
      { mode: 'staff', restaurant },
      loaded,
    );
    assert.equal(decision.ok, true);
    if (decision.ok) {
      assert.equal(decision.closedReason, 'owner_closed');
    }
  });

  it('rejects cashier with only tables.checkout_close', () => {
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
    );
    assert.equal(decision.ok, false);
  });

  it('allows cashier preset when tables.force_close is present', () => {
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
      capabilities: capabilitiesFromKeys(['tables.force_close']),
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
    );
    assert.equal(decision.ok, true);
    if (decision.ok) {
      assert.equal(decision.closedReason, 'cashier_closed');
    }
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
    );
    assert.equal(decision.ok, true);
  });
});
