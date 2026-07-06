import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validateStaffPasswordChangeInput } from './staff-change-password-validation';

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
