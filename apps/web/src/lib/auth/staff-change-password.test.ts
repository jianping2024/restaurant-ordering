import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validateStaffPasswordChangeInput } from './staff-change-password-validation';

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
