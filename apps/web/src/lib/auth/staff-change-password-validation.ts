import { staffPasswordValid } from '../staff-account';

export type StaffChangePasswordValidationError =
  | 'password_short'
  | 'password_mismatch'
  | 'password_same_as_old';

export function validateStaffPasswordChangeInput(input: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): StaffChangePasswordValidationError | null {
  if (!staffPasswordValid(input.newPassword)) return 'password_short';
  if (input.newPassword !== input.confirmPassword) return 'password_mismatch';
  if (input.newPassword === input.currentPassword) return 'password_same_as_old';
  return null;
}
