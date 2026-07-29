import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { User } from '@supabase/supabase-js';
import { resolveStaffPasswordChangeSuccess } from './staff-change-password-outcome';
import { validateStaffPasswordChangeInput } from './staff-change-password-validation';
import type { StaffUserMetadata } from '../staff-account';

describe('validateStaffPasswordChangeInput', () => {
  it('rejects short new password', () => {
    assert.equal(
      validateStaffPasswordChangeInput({
        currentPassword: 'old123',
        newPassword: '12345',
        confirmPassword: '12345',
      }),
      'password_short',
    );
  });

  it('rejects mismatched confirmation', () => {
    assert.equal(
      validateStaffPasswordChangeInput({
        currentPassword: 'old123',
        newPassword: '123456',
        confirmPassword: '654321',
      }),
      'password_mismatch',
    );
  });

  it('rejects unchanged password', () => {
    assert.equal(
      validateStaffPasswordChangeInput({
        currentPassword: 'same12',
        newPassword: 'same12',
        confirmPassword: 'same12',
      }),
      'password_same_as_old',
    );
  });
});

describe('resolveStaffPasswordChangeSuccess', () => {
  const user = {
    id: 'u1',
    user_metadata: { account_type: 'staff', must_change_password: true, extra: 1 },
  } as unknown as User;

  const staffMeta: StaffUserMetadata = {
    account_type: 'staff',
    must_change_password: true,
    staff_role: 'kitchen',
    restaurant_id: 'r1',
    staff_account_id: 'a1',
    restaurant_slug: 'demo-slug',
  };

  it('clears must_change_password and returns role path for staff', () => {
    const result = resolveStaffPasswordChangeSuccess(user, staffMeta);
    assert.equal(result.path, '/demo-slug/kitchen');
    assert.deepEqual(result.updateData, {
      account_type: 'staff',
      must_change_password: false,
      extra: 1,
    });
  });

  it('returns no path and no metadata patch for non-staff sessions', () => {
    const result = resolveStaffPasswordChangeSuccess(user, null);
    assert.equal(result.path, null);
    assert.equal(result.updateData, undefined);
  });
});
