import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  accountPasswordPolicyError,
  accountPasswordValid,
  staffLoginRequiresPasswordChange,
} from './account-password-policy';

describe('accountPasswordPolicyError', () => {
  it('rejects short passwords', () => {
    assert.equal(accountPasswordPolicyError('Ab1'), 'password_short');
    assert.equal(accountPasswordPolicyError('Abcde12'), 'password_short');
  });

  it('requires letter and digit', () => {
    assert.equal(accountPasswordPolicyError('abcdefgh'), 'password_need_letter_digit');
    assert.equal(accountPasswordPolicyError('12345678'), 'password_need_letter_digit');
  });

  it('rejects denylisted weak passwords', () => {
    assert.equal(accountPasswordPolicyError('password1'), 'password_weak');
    assert.equal(accountPasswordPolicyError('Password1'), 'password_weak');
  });

  it('rejects password equal to login name', () => {
    assert.equal(
      accountPasswordPolicyError('Qiantai1', { loginName: 'qiantai1' }),
      'password_matches_login',
    );
  });

  it('accepts compliant passwords', () => {
    assert.equal(accountPasswordPolicyError('MesaUat1'), null);
    assert.equal(accountPasswordPolicyError('MesaUat1', { loginName: 'qiantai1' }), null);
    assert.equal(accountPasswordValid('GoodPass9'), true);
  });
});

describe('staffLoginRequiresPasswordChange', () => {
  it('is true when metadata flag set', () => {
    assert.equal(
      staffLoginRequiresPasswordChange({
        mustChangePasswordFlag: true,
        password: 'MesaUat1',
        loginName: 'qiantai1',
      }),
      true,
    );
  });

  it('is true when plaintext fails policy', () => {
    assert.equal(
      staffLoginRequiresPasswordChange({
        mustChangePasswordFlag: false,
        password: '123456',
        loginName: 'qiantai1',
      }),
      true,
    );
  });

  it('is false when strong and no flag', () => {
    assert.equal(
      staffLoginRequiresPasswordChange({
        mustChangePasswordFlag: false,
        password: 'MesaUat1',
        loginName: 'qiantai1',
      }),
      false,
    );
  });
});
