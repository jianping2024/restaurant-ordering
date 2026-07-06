import type { SupabaseClient } from '@supabase/supabase-js';
import { parseStaffUserMetadata } from '@/lib/staff-account';
import { staffRolePath } from '@/lib/staff-routes';
import { verifyStaffPassword } from '@/lib/verify-staff-password';
import {
  validateStaffPasswordChangeInput,
  type StaffChangePasswordValidationError,
} from '@/lib/auth/staff-change-password-validation';

export type StaffChangePasswordError =
  | 'unauthorized'
  | 'invalid_password'
  | StaffChangePasswordValidationError
  | 'update_failed';

export type StaffChangePasswordResult =
  | { ok: true; path: string }
  | { ok: false; error: StaffChangePasswordError };

export async function changeStaffPasswordWithSession(
  supabase: SupabaseClient,
  input: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  },
): Promise<StaffChangePasswordResult> {
  const { currentPassword, newPassword, confirmPassword } = input;

  const validationError = validateStaffPasswordChangeInput({
    currentPassword,
    newPassword,
    confirmPassword,
  });
  if (validationError) {
    return { ok: false, error: validationError };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const meta = parseStaffUserMetadata(user?.user_metadata as Record<string, unknown> | undefined);
  if (!user || !meta || meta.must_change_password !== true) {
    return { ok: false, error: 'unauthorized' };
  }

  const verify = await verifyStaffPassword(currentPassword);
  if (!verify.ok) {
    if (verify.error === 'invalid_password') {
      return { ok: false, error: 'invalid_password' };
    }
    return { ok: false, error: 'unauthorized' };
  }

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
    data: { ...user.user_metadata, must_change_password: false },
  });
  if (error) {
    return { ok: false, error: 'update_failed' };
  }

  return { ok: true, path: staffRolePath(meta.restaurant_slug, meta.staff_role) };
}
