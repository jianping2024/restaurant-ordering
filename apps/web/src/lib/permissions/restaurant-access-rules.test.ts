import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { can } from '@/lib/permissions/can';
import {
  authorizedRestaurantsFromLoads,
  deriveStaffLoginTarget,
  normalizeStaffMembershipRow,
  principalAdmittedWhileSuspended,
  resolveRestaurantMembershipPrincipal,
  type RestaurantRef,
  type StaffMembershipRow,
} from '@/lib/permissions/restaurant-access-rules';

const SUSPENDED = '2026-01-01T00:00:00Z';
const USER = 'u-1';

function store(id: string, suspended_at: string | null = null): RestaurantRef {
  return { id, slug: `slug-${id}`, suspended_at };
}

function membership(
  restaurantId: string,
  over: Partial<StaffMembershipRow> & { roleDisabled?: boolean; suspended?: boolean } = {},
): StaffMembershipRow {
  const { roleDisabled, suspended, ...rest } = over;
  return {
    id: `m-${restaurantId}`,
    restaurant_id: restaurantId,
    role: 'cashier',
    role_id: `role-${restaurantId}`,
    disabled_at: null,
    restaurant: store(restaurantId, suspended ? SUSPENDED : null),
    role_row: {
      id: `role-${restaurantId}`,
      restaurant_id: restaurantId,
      name: `Cashier ${restaurantId}`,
      preset_key: 'cashier',
      permissions: ['dashboard.checkout.view'],
      disabled_at: roleDisabled ? SUSPENDED : null,
    },
    ...rest,
  };
}

describe('resolveRestaurantMembershipPrincipal', () => {
  it('admin account of this store gets *', () => {
    const access = resolveRestaurantMembershipPrincipal({
      userId: USER,
      restaurantId: 'A',
      owned: store('A'),
      membership: null,
    });
    assert.equal(access?.principal.kind, 'owner');
    assert.equal(access?.capabilities, '*');
    assert.equal(access?.restaurant.id, 'A');
  });

  it('admin account has nothing in another store', () => {
    const access = resolveRestaurantMembershipPrincipal({
      userId: USER,
      restaurantId: 'B',
      owned: store('A'),
      membership: null,
    });
    assert.equal(access, null);
  });

  it('multi-row staff: each store resolves its own membership and role', () => {
    const a = resolveRestaurantMembershipPrincipal({
      userId: USER,
      restaurantId: 'A',
      owned: null,
      membership: membership('A'),
    });
    const b = resolveRestaurantMembershipPrincipal({
      userId: USER,
      restaurantId: 'B',
      owned: null,
      membership: membership('B', {
        role_row: {
          id: 'role-B',
          restaurant_id: 'B',
          name: 'Kitchen B',
          preset_key: 'kitchen',
          permissions: ['floor.kitchen_board.view'],
          disabled_at: null,
        },
      }),
    });
    assert.equal(a?.principal.kind, 'staff');
    assert.equal(a?.principal.restaurantId, 'A');
    assert.ok(a && can(a.capabilities, 'dashboard.checkout.view'));
    assert.ok(a && !can(a.capabilities, 'floor.kitchen_board.view'));
    assert.equal(b?.principal.restaurantId, 'B');
    assert.ok(b && can(b.capabilities, 'floor.kitchen_board.view'));
    assert.ok(b && !can(b.capabilities, 'dashboard.checkout.view'));
  });

  it('membership row of a different store never authorizes this store', () => {
    const access = resolveRestaurantMembershipPrincipal({
      userId: USER,
      restaurantId: 'B',
      owned: null,
      membership: membership('A'),
    });
    assert.equal(access, null);
  });

  it('disabled membership / disabled role / missing role / print_agent → null', () => {
    const cases: StaffMembershipRow[] = [
      membership('A', { disabled_at: SUSPENDED }),
      membership('A', { roleDisabled: true }),
      membership('A', { role_id: null }),
      membership('A', { role_row: null }),
      membership('A', { role: 'print_agent' }),
      membership('A', {
        role_row: { ...membership('A').role_row!, restaurant_id: 'other' },
      }),
    ];
    for (const row of cases) {
      assert.equal(
        resolveRestaurantMembershipPrincipal({
          userId: USER,
          restaurantId: 'A',
          owned: null,
          membership: row,
        }),
        null,
      );
    }
  });
});

describe('principalAdmittedWhileSuspended (§6.2)', () => {
  it('admin account may enter a suspended store; staff may not', () => {
    const owner = resolveRestaurantMembershipPrincipal({
      userId: USER,
      restaurantId: 'A',
      owned: store('A', SUSPENDED),
      membership: null,
    });
    const staff = resolveRestaurantMembershipPrincipal({
      userId: USER,
      restaurantId: 'A',
      owned: null,
      membership: membership('A', { suspended: true }),
    });
    assert.ok(owner && principalAdmittedWhileSuspended(owner));
    assert.ok(staff && !principalAdmittedWhileSuspended(staff));
  });

  it('active store admits staff', () => {
    const staff = resolveRestaurantMembershipPrincipal({
      userId: USER,
      restaurantId: 'A',
      owned: null,
      membership: membership('A'),
    });
    assert.ok(staff && principalAdmittedWhileSuspended(staff));
  });
});

describe('authorizedRestaurantsFromLoads', () => {
  it('admin account lists only its one store', () => {
    const list = authorizedRestaurantsFromLoads({
      owned: store('A'),
      memberships: [membership('B')],
    });
    assert.deepEqual(
      list.map((r) => [r.id, r.access]),
      [['A', 'owner']],
    );
  });

  it('staff lists enabled human memberships, suspended last, deduped', () => {
    const list = authorizedRestaurantsFromLoads({
      owned: null,
      memberships: [
        membership('S', { suspended: true }),
        membership('A'),
        membership('D', { disabled_at: SUSPENDED }),
        membership('P', { role: 'print_agent' }),
        membership('R', { roleDisabled: true }),
        membership('B'),
        membership('A'),
      ],
    });
    assert.deepEqual(
      list.map((r) => r.id),
      ['A', 'B', 'S'],
    );
    assert.ok(list.every((r) => r.access === 'staff'));
    assert.equal(list[2].suspended_at, SUSPENDED);
  });
});

describe('deriveStaffLoginTarget', () => {
  it('unknown login name or nothing enterable → invalid_credentials', () => {
    assert.deepEqual(deriveStaffLoginTarget({ userId: null, restaurants: [] }), {
      ok: false,
      code: 'invalid_credentials',
    });
    assert.deepEqual(deriveStaffLoginTarget({ userId: USER, restaurants: [] }), {
      ok: false,
      code: 'invalid_credentials',
    });
  });

  it('every enterable store suspended → restaurant_suspended with reason', () => {
    const res = deriveStaffLoginTarget({
      userId: USER,
      restaurants: [
        { ...store('A', SUSPENDED), access: 'staff', suspension_reason: 'license_expired' },
        { ...store('B', SUSPENDED), access: 'staff', suspension_reason: null },
      ],
    });
    assert.deepEqual(res, {
      ok: false,
      code: 'restaurant_suspended',
      suspension_reason: 'license_expired',
    });
  });

  it('one open store is enough; suspended ones listed last', () => {
    const res = deriveStaffLoginTarget({
      userId: USER,
      restaurants: [
        { ...store('S', SUSPENDED), access: 'staff', suspension_reason: 'x' },
        { ...store('A'), access: 'staff', suspension_reason: null },
      ],
    });
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.userId, USER);
      assert.deepEqual(
        res.restaurants.map((r) => r.id),
        ['A', 'S'],
      );
      assert.ok(!('suspension_reason' in res.restaurants[0]));
    }
  });
});

describe('normalizeStaffMembershipRow', () => {
  it('reads PostgREST embeds (object or array)', () => {
    const row = normalizeStaffMembershipRow({
      id: 'm1',
      restaurant_id: 'A',
      role: 'custom',
      role_id: 'r1',
      disabled_at: null,
      restaurants: [{ id: 'A', slug: 'a', suspended_at: null }],
      restaurant_roles: {
        id: 'r1',
        restaurant_id: 'A',
        name: 'Gerente',
        preset_key: null,
        permissions: ['dashboard.overview.view', 'unknown.key'],
        disabled_at: null,
      },
    });
    assert.equal(row?.restaurant?.slug, 'a');
    assert.equal(row?.role_row?.name, 'Gerente');
    const access = resolveRestaurantMembershipPrincipal({
      userId: USER,
      restaurantId: 'A',
      owned: null,
      membership: row,
    });
    assert.equal(access?.principal.kind === 'staff' && access.principal.staffRoleLabel, 'custom');
    assert.ok(access && can(access.capabilities, 'dashboard.overview.view'));
  });

  it('rejects malformed rows', () => {
    assert.equal(normalizeStaffMembershipRow(null), null);
    assert.equal(normalizeStaffMembershipRow({ id: 1 }), null);
  });
});
