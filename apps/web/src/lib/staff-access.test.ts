import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveOpenTableStaffAccess,
  deriveStaffAccessForSlug,
  deriveStaffLoginContext,
  deriveStaffLoginPreflight,
  type StaffGateAccount,
  type OwnerGateRestaurant,
} from './staff-identity-gate';

const USER = 'user-1';
const SLUG = 'restaurant-mohnrib5';
const RESTAURANT_ID = 'rest-1';

function staffRow(overrides: Partial<StaffGateAccount> = {}): StaffGateAccount {
  return {
    id: 'staff-1',
    restaurant_id: RESTAURANT_ID,
    role: 'frontdesk',
    disabled_at: null,
    restaurant: {
      id: RESTAURANT_ID,
      slug: SLUG,
      suspended_at: null,
    },
    ...overrides,
  };
}

function ownerRow(overrides: Partial<OwnerGateRestaurant> = {}): OwnerGateRestaurant {
  return {
    id: RESTAURANT_ID,
    slug: SLUG,
    suspended_at: null,
    ...overrides,
  };
}

describe('deriveStaffAccessForSlug', () => {
  it('prefers owner when both owner and staff rows match', () => {
    const result = deriveStaffAccessForSlug({
      userId: USER,
      slug: SLUG,
      allowedRoles: ['waiter', 'frontdesk'],
      userMetadata: {},
      owner: ownerRow(),
      staff: staffRow({ role: 'frontdesk' }),
    });
    assert.equal(result.status, 'ok');
    if (result.status === 'ok') {
      assert.equal(result.as_owner, true);
      assert.equal(result.role, 'waiter');
    }
  });

  it('allows matching staff when not owner', () => {
    const result = deriveStaffAccessForSlug({
      userId: USER,
      slug: SLUG,
      allowedRoles: ['frontdesk'],
      userMetadata: {},
      owner: null,
      staff: staffRow({ role: 'frontdesk' }),
    });
    assert.equal(result.status, 'ok');
    if (result.status === 'ok') {
      assert.equal(result.as_owner, false);
      assert.equal(result.role, 'frontdesk');
    }
  });

  it('denies wrong slug for staff', () => {
    const result = deriveStaffAccessForSlug({
      userId: USER,
      slug: SLUG,
      allowedRoles: ['frontdesk'],
      userMetadata: {},
      owner: null,
      staff: staffRow({
        restaurant: { id: RESTAURANT_ID, slug: 'other-slug', suspended_at: null },
      }),
    });
    assert.deepEqual(result, { status: 'denied', reason: 'wrong_context' });
  });

  it('denies suspended restaurant for staff', () => {
    const result = deriveStaffAccessForSlug({
      userId: USER,
      slug: SLUG,
      allowedRoles: ['frontdesk'],
      userMetadata: {},
      owner: null,
      staff: staffRow({
        restaurant: { id: RESTAURANT_ID, slug: SLUG, suspended_at: '2026-01-01T00:00:00Z' },
      }),
    });
    assert.deepEqual(result, { status: 'denied', reason: 'restaurant_suspended' });
  });

  it('denies needs_password_change from metadata', () => {
    const result = deriveStaffAccessForSlug({
      userId: USER,
      slug: SLUG,
      allowedRoles: ['frontdesk'],
      userMetadata: {
        account_type: 'staff',
        must_change_password: true,
        staff_role: 'frontdesk',
        restaurant_id: RESTAURANT_ID,
        staff_account_id: 'staff-1',
        restaurant_slug: SLUG,
      },
      owner: null,
      staff: staffRow(),
    });
    assert.deepEqual(result, { status: 'denied', reason: 'needs_password_change' });
  });
});

describe('deriveOpenTableStaffAccess', () => {
  it('prefers matching floor staff over owner', () => {
    const result = deriveOpenTableStaffAccess({
      userId: USER,
      slug: SLUG,
      restaurantId: RESTAURANT_ID,
      userMetadata: {},
      owner: { id: RESTAURANT_ID, slug: SLUG },
      staff: staffRow({ role: 'waiter' }),
    });
    assert.equal(result.status, 'ok');
    if (result.status === 'ok') {
      assert.equal(result.as_owner, false);
      assert.equal(result.role, 'waiter');
    }
  });

  it('falls back to owner as waiter role', () => {
    const result = deriveOpenTableStaffAccess({
      userId: USER,
      slug: SLUG,
      restaurantId: RESTAURANT_ID,
      userMetadata: {},
      owner: { id: RESTAURANT_ID, slug: SLUG },
      staff: null,
    });
    assert.equal(result.status, 'ok');
    if (result.status === 'ok') {
      assert.equal(result.as_owner, true);
      assert.equal(result.role, 'waiter');
    }
  });
});

describe('deriveStaffLoginPreflight', () => {
  it('rejects missing or disabled accounts as invalid_credentials', () => {
    assert.deepEqual(deriveStaffLoginPreflight({ account: null }), {
      ok: false,
      code: 'invalid_credentials',
    });
    assert.deepEqual(
      deriveStaffLoginPreflight({
        account: {
          disabled_at: '2026-01-01T00:00:00Z',
          role: 'frontdesk',
          restaurant_suspended_at: null,
        },
      }),
      { ok: false, code: 'invalid_credentials' },
    );
  });

  it('rejects suspended restaurant', () => {
    assert.deepEqual(
      deriveStaffLoginPreflight({
        account: {
          disabled_at: null,
          role: 'frontdesk',
          restaurant_suspended_at: '2026-01-01T00:00:00Z',
        },
      }),
      { ok: false, code: 'restaurant_suspended' },
    );
  });

  it('accepts enabled staff', () => {
    assert.deepEqual(
      deriveStaffLoginPreflight({
        account: {
          disabled_at: null,
          role: 'frontdesk',
          restaurant_suspended_at: null,
        },
      }),
      { ok: true },
    );
  });
});

describe('deriveStaffLoginContext', () => {
  it('returns onboarding when no staff and no staff meta', () => {
    assert.deepEqual(
      deriveStaffLoginContext({ userMetadata: {}, staff: null }),
      { kind: 'onboarding' },
    );
  });

  it('returns staff landing from gate restaurant slug', () => {
    const result = deriveStaffLoginContext({
      userMetadata: {},
      staff: staffRow({ role: 'cashier' }),
    });
    assert.equal(result.kind, 'staff');
    if (result.kind === 'staff') {
      assert.equal(result.context.role, 'cashier');
      assert.equal(result.context.slug, SLUG);
      assert.equal(result.context.mustChangePassword, false);
    }
  });

  it('can skip suspend check after preflight', () => {
    const suspended = staffRow({
      restaurant: { id: RESTAURANT_ID, slug: SLUG, suspended_at: '2026-01-01T00:00:00Z' },
    });
    assert.equal(
      deriveStaffLoginContext({ userMetadata: {}, staff: suspended }).kind,
      'staff_error',
    );
    const skipped = deriveStaffLoginContext({
      userMetadata: {},
      staff: suspended,
      options: { skipSuspendCheck: true },
    });
    assert.equal(skipped.kind, 'staff');
  });
});
