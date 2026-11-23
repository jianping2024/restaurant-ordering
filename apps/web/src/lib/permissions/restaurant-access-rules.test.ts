import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { can } from '@/lib/permissions/can';
import {
  authorizedRestaurantsFromLoads,
  deriveStaffLoginTarget,
  normalizeStaffMembershipRow,
  pickLandingRestaurant,
  resolveRestaurantMembershipPrincipal,
  type AuthorizedRestaurant,
  type MembershipRestaurantRef,
  type RestaurantRef,
  type StaffMembershipRow,
} from '@/lib/permissions/restaurant-access-rules';

const SUSPENDED = '2026-01-01T00:00:00Z';
const USER = 'u-1';

function store(id: string, suspended_at: string | null = null): MembershipRestaurantRef {
  return { id, slug: `slug-${id}`, suspended_at, name: `Store ${id}`, address: `Rua ${id}, 1000-001 Lisboa` };
}

function ownedRef(id: string): RestaurantRef {
  return { id, slug: `slug-${id}`, suspended_at: null };
}

function listed(id: string, over: Partial<AuthorizedRestaurant> = {}): AuthorizedRestaurant {
  return {
    ...ownedRef(id),
    access: 'staff',
    name: `Store ${id}`,
    city: 'Lisboa',
    roleName: 'Cashier',
    favoritedAt: null,
    landingPath: `/dashboard/r/slug-${id}/checkout`,
    ...over,
  };
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
    favorited_at: null,
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
      owned: { ...ownedRef('A'), suspended_at: SUSPENDED },
      membership: null,
    });
    // Admin of a suspended store is admitted (read-only banner).
    assert.equal(access?.principal.kind, 'owner');
    assert.equal(access?.capabilities, '*');
    assert.equal(access?.restaurant.id, 'A');
  });

  it('admin account has nothing in another store', () => {
    const access = resolveRestaurantMembershipPrincipal({
      userId: USER,
      restaurantId: 'B',
      owned: ownedRef('A'),
      membership: null,
    });
    assert.equal(access, null);
  });

  it('staff of a suspended store is refused (plan §6.2)', () => {
    const access = resolveRestaurantMembershipPrincipal({
      userId: USER,
      restaurantId: 'A',
      owned: null,
      membership: membership('A', { suspended: true }),
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

describe('authorizedRestaurantsFromLoads', () => {
  it('admin account lists only its one store', () => {
    const list = authorizedRestaurantsFromLoads({
      owned: ownedRef('A'),
      memberships: [membership('B')],
    });
    assert.deepEqual(
      list.map((r) => [r.id, r.access, r.landingPath]),
      [['A', 'owner', '/dashboard/r/slug-A/waiter']],
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

  it('carries name, city, role, favorite and per-store landing for the store list', () => {
    const [a] = authorizedRestaurantsFromLoads({
      owned: null,
      memberships: [membership('A', { favorited_at: SUSPENDED })],
    });
    assert.equal(a.name, 'Store A');
    assert.equal(a.city, 'Lisboa');
    assert.equal(a.roleName, 'Cashier A');
    assert.equal(a.favoritedAt, SUSPENDED);
    assert.equal(a.landingPath, '/dashboard/r/slug-A/checkout');
  });
});

describe('pickLandingRestaurant', () => {
  it('nothing listed → none; one enterable → it', () => {
    assert.deepEqual(pickLandingRestaurant([]), { kind: 'none' });
    const one = pickLandingRestaurant([listed('A'), listed('S', { suspended_at: SUSPENDED })]);
    assert.equal(one.kind === 'store' && one.restaurant.id, 'A');
  });

  it('several enterable: last store when still enterable, else picker', () => {
    const stores = [listed('A'), listed('B'), listed('S', { suspended_at: SUSPENDED })];
    const last = pickLandingRestaurant(stores, { lastRestaurantId: 'B' });
    assert.equal(last.kind === 'store' && last.restaurant.id, 'B');
    assert.deepEqual(pickLandingRestaurant(stores), { kind: 'select' });
    assert.deepEqual(pickLandingRestaurant(stores, { lastRestaurantId: 'S' }), { kind: 'select' });
    assert.deepEqual(pickLandingRestaurant(stores, { lastRestaurantId: 'gone' }), { kind: 'select' });
  });

  it("a store's own login page wins when enterable", () => {
    const stores = [listed('A'), listed('B')];
    const res = pickLandingRestaurant(stores, { lastRestaurantId: 'A', preferredSlug: 'slug-B' });
    assert.equal(res.kind === 'store' && res.restaurant.id, 'B');
  });

  it('only suspended stores (staff) → picker shows them greyed; admin still enters', () => {
    assert.deepEqual(pickLandingRestaurant([listed('S', { suspended_at: SUSPENDED })]), {
      kind: 'select',
    });
    const owner = pickLandingRestaurant([listed('O', { access: 'owner', suspended_at: SUSPENDED })]);
    assert.equal(owner.kind, 'store');
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
        { ...listed('A', { suspended_at: SUSPENDED }), suspension_reason: 'license_expired' },
        { ...listed('B', { suspended_at: SUSPENDED }), suspension_reason: null },
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
        { ...listed('S', { suspended_at: SUSPENDED }), suspension_reason: 'x' },
        { ...listed('A'), suspension_reason: null },
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
      favorited_at: '2026-11-01T00:00:00Z',
      restaurants: [{ id: 'A', slug: 'a', suspended_at: null, name: 'Casa A', address: 'Av. X, 4000-001 Porto' }],
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
    assert.equal(row?.restaurant?.name, 'Casa A');
    assert.equal(row?.favorited_at, '2026-11-01T00:00:00Z');
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
