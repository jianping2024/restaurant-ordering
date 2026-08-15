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
        currentPassword: 'OldPass1',
        newPassword: 'Ab1',
        confirmPassword: 'Ab1',
      }),
      'password_short',
    );
  });

  it('rejects password without letter and digit', () => {
    assert.equal(
      validateStaffPasswordChangeInput({
        currentPassword: 'OldPass1',
        newPassword: 'abcdefgh',
        confirmPassword: 'abcdefgh',
      }),
      'password_need_letter_digit',
    );
  });

  it('rejects mismatched confirmation', () => {
    assert.equal(
      validateStaffPasswordChangeInput({
        currentPassword: 'OldPass1',
        newPassword: 'MesaUat1',
        confirmPassword: 'MesaUat2',
      }),
      'password_mismatch',
    );
  });

  it('rejects unchanged password', () => {
    assert.equal(
      validateStaffPasswordChangeInput({
        currentPassword: 'MesaUat1',
        newPassword: 'MesaUat1',
        confirmPassword: 'MesaUat1',
      }),
      'password_same_as_old',
    );
  });

  it('rejects password matching login name', () => {
    assert.equal(
      validateStaffPasswordChangeInput({
        currentPassword: 'OldPass1',
        newPassword: 'Qiantai1',
        confirmPassword: 'Qiantai1',
        loginName: 'qiantai1',
      }),
      'password_matches_login',
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

  it('clears must_change_password for staff', () => {
    const result = resolveStaffPasswordChangeSuccess(user, staffMeta);
    assert.deepEqual(result.updateData, {
      account_type: 'staff',
      must_change_password: false,
      extra: 1,
    });
  });

  it('returns no metadata patch for non-staff sessions', () => {
    const result = resolveStaffPasswordChangeSuccess(user, null);
    assert.equal(result.updateData, undefined);
  });
});
