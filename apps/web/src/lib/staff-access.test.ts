import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  deriveStaffLoginContext,
  deriveStaffLoginPreflight,
  type StaffGateAccount,
} from './staff-identity-gate';

const SLUG = 'restaurant-mohnrib5';
const RESTAURANT_ID = 'rest-1';
const ROLE_ID = 'role-kitchen-1';

function staffRow(overrides: Partial<StaffGateAccount> = {}): StaffGateAccount {
  return {
    id: 'staff-1',
    restaurant_id: RESTAURANT_ID,
    role: 'kitchen',
    role_id: ROLE_ID,
    disabled_at: null,
    restaurant: {
      id: RESTAURANT_ID,
      slug: SLUG,
      suspended_at: null,
    },
    ...overrides,
  };
}

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
          role: 'kitchen',
          role_id: ROLE_ID,
          restaurant_suspended_at: null,
        },
      }),
      { ok: false, code: 'invalid_credentials' },
    );
  });

  it('rejects staff without role_id', () => {
    assert.deepEqual(
      deriveStaffLoginPreflight({
        account: {
          disabled_at: null,
          role: 'kitchen',
          role_id: null,
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
          role: 'kitchen',
          role_id: ROLE_ID,
          restaurant_suspended_at: '2026-01-01T00:00:00Z',
        },
      }),
      { ok: false, code: 'restaurant_suspended' },
    );
  });

  it('rejects staff whose restaurant role is disabled', () => {
    assert.deepEqual(
      deriveStaffLoginPreflight({
        account: {
          disabled_at: null,
          role: 'kitchen',
          role_id: ROLE_ID,
          restaurant_suspended_at: null,
          role_disabled_at: '2026-01-01T00:00:00Z',
        },
      }),
      { ok: false, code: 'invalid_credentials' },
    );
  });

  it('accepts enabled staff with role_id', () => {
    assert.deepEqual(
      deriveStaffLoginPreflight({
        account: {
          disabled_at: null,
          role: 'kitchen',
          role_id: ROLE_ID,
          restaurant_suspended_at: null,
        },
      }),
      { ok: true },
    );
  });

  it('accepts custom role label when role_id is set', () => {
    assert.deepEqual(
      deriveStaffLoginPreflight({
        account: {
          disabled_at: null,
          role: 'custom',
          role_id: ROLE_ID,
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
      staff: staffRow({ role: 'custom' }),
    });
    assert.equal(result.kind, 'staff');
    if (result.kind === 'staff') {
      assert.equal(result.context.roleLabel, 'custom');
      assert.equal(result.context.slug, SLUG);
      assert.equal(result.context.mustChangePassword, false);
    }
  });

  it('rejects staff without role_id', () => {
    assert.equal(
      deriveStaffLoginContext({
        userMetadata: {},
        staff: staffRow({ role_id: null }),
      }).kind,
      'staff_error',
    );
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
