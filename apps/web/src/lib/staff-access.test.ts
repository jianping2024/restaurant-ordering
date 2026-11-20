import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  deriveStaffLoginContext,
  resolveOwnerRestaurantFromLoads,
  type OwnerGateRestaurant,
} from './staff-identity-gate';
import { can } from './permissions/can';
import type { StaffMembershipRow } from './permissions/restaurant-access-rules';

const SLUG = 'restaurant-mohnrib5';
const RESTAURANT_ID = 'rest-1';
const ROLE_ID = 'role-kitchen-1';
const SUSPENDED = '2026-01-01T00:00:00Z';

function membership(overrides: Partial<StaffMembershipRow> = {}): StaffMembershipRow {
  return {
    id: 'staff-1',
    restaurant_id: RESTAURANT_ID,
    role: 'kitchen',
    role_id: ROLE_ID,
    disabled_at: null,
    restaurant: { id: RESTAURANT_ID, slug: SLUG, suspended_at: null },
    role_row: {
      id: ROLE_ID,
      restaurant_id: RESTAURANT_ID,
      name: 'Kitchen',
      preset_key: 'kitchen',
      permissions: ['floor.kitchen_board.view'],
      disabled_at: null,
    },
    ...overrides,
  };
}

const IDENTITY = { must_change_password: false };

describe('deriveStaffLoginContext', () => {
  it('returns onboarding for an account with no staff identity and no membership', () => {
    assert.deepEqual(deriveStaffLoginContext({ identity: null, memberships: [] }), {
      kind: 'onboarding',
    });
  });

  it('staff identity without any membership is incomplete', () => {
    assert.deepEqual(deriveStaffLoginContext({ identity: IDENTITY, memberships: [] }), {
      kind: 'staff_error',
      code: 'incomplete',
    });
  });

  it('lands in the enterable store with role label and capabilities', () => {
    const result = deriveStaffLoginContext({
      identity: IDENTITY,
      memberships: [membership({ role: 'custom' })],
    });
    assert.equal(result.kind, 'staff');
    if (result.kind === 'staff') {
      assert.equal(result.context.roleLabel, 'custom');
      assert.equal(result.context.slug, SLUG);
      assert.equal(result.context.mustChangePassword, false);
      assert.equal(can(result.context.capabilities, 'floor.kitchen_board.view'), true);
    }
  });

  it('reads must_change_password from the identity row', () => {
    const result = deriveStaffLoginContext({
      identity: { must_change_password: true },
      memberships: [membership()],
    });
    assert.equal(result.kind === 'staff' && result.context.mustChangePassword, true);
  });

  it('every membership disabled → disabled', () => {
    assert.deepEqual(
      deriveStaffLoginContext({
        identity: IDENTITY,
        memberships: [membership({ disabled_at: SUSPENDED })],
      }),
      { kind: 'staff_error', code: 'disabled' },
    );
  });

  it('rejects staff without role_id or with print_agent role', () => {
    for (const over of [{ role_id: null }, { role: 'print_agent' }]) {
      assert.deepEqual(
        deriveStaffLoginContext({ identity: IDENTITY, memberships: [membership(over)] }),
        { kind: 'staff_error', code: 'incomplete' },
      );
    }
  });

  it('can skip suspend check after preflight', () => {
    const suspended = membership({
      restaurant: { id: RESTAURANT_ID, slug: SLUG, suspended_at: SUSPENDED },
    });
    assert.deepEqual(
      deriveStaffLoginContext({ identity: IDENTITY, memberships: [suspended] }),
      { kind: 'staff_error', code: 'restaurant_suspended' },
    );
    const skipped = deriveStaffLoginContext({
      identity: IDENTITY,
      memberships: [suspended],
      options: { skipSuspendCheck: true },
    });
    assert.equal(skipped.kind, 'staff');
  });
});

const OWNED: OwnerGateRestaurant = {
  id: 'rest-owned',
  slug: 'slug-owned',
  suspended_at: null,
};
const CLAIMED: OwnerGateRestaurant = {
  id: 'rest-claimed',
  slug: 'slug-claimed',
  suspended_at: null,
};

describe('resolveOwnerRestaurantFromLoads', () => {
  it('owner_id row wins over shadow claimed store', () => {
    assert.deepEqual(
      resolveOwnerRestaurantFromLoads({
        ownedByOwnerId: OWNED,
        isOwnerShadow: true,
        claimedRestaurant: CLAIMED,
      }),
      OWNED,
    );
  });

  it('shadow uses claimed store when not owner_id', () => {
    assert.deepEqual(
      resolveOwnerRestaurantFromLoads({
        ownedByOwnerId: null,
        isOwnerShadow: true,
        claimedRestaurant: CLAIMED,
      }),
      CLAIMED,
    );
  });

  it('shadow without claimed store is not an owner', () => {
    assert.equal(
      resolveOwnerRestaurantFromLoads({
        ownedByOwnerId: null,
        isOwnerShadow: true,
        claimedRestaurant: null,
      }),
      null,
    );
  });

  it('non-owner non-shadow is not an owner', () => {
    assert.equal(
      resolveOwnerRestaurantFromLoads({
        ownedByOwnerId: null,
        isOwnerShadow: false,
        claimedRestaurant: CLAIMED,
      }),
      null,
    );
  });
});
