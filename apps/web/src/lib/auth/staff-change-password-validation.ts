import {
  accountPasswordPolicyError,
  type AccountPasswordPolicyError,
} from '@/lib/auth/account-password-policy';

export type StaffChangePasswordValidationError =
  | AccountPasswordPolicyError
  | 'password_mismatch'
  | 'password_same_as_old';

export function validateStaffPasswordChangeInput(input: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  loginName?: string | null;
}): StaffChangePasswordValidationError | null {
  const policyError = accountPasswordPolicyError(input.newPassword, {
    loginName: input.loginName,
  });
  if (policyError) return policyError;
  if (input.newPassword !== input.confirmPassword) return 'password_mismatch';
  if (input.newPassword === input.currentPassword) return 'password_same_as_old';
  return null;
}
