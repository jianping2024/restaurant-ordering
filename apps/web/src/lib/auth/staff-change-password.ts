import type { SupabaseClient } from '@supabase/supabase-js';
import { parseStaffUserMetadata } from '@/lib/staff-account';
import { verifyStaffPassword } from '@/lib/verify-staff-password';
import {
  validateStaffPasswordChangeInput,
  type StaffChangePasswordValidationError,
} from '@/lib/auth/staff-change-password-validation';
import { resolveStaffPasswordChangeSuccess } from '@/lib/auth/staff-change-password-outcome';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadStaffGateAccountForUser } from '@/lib/staff-gate-db';
import { resolveStaffLandingPath } from '@/lib/permissions/staff-landing';

export type StaffChangePasswordError =
  | 'unauthorized'
  | 'invalid_password'
  | StaffChangePasswordValidationError
  | 'update_failed';

export type StaffChangePasswordResult =
  | { ok: true; path: string | null }
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
  if (!user) {
    return { ok: false, error: 'unauthorized' };
  }

  const meta = parseStaffUserMetadata(user.user_metadata as Record<string, unknown> | undefined);

  const verify = await verifyStaffPassword(currentPassword);
  if (!verify.ok) {
    if (verify.error === 'invalid_password') {
      return { ok: false, error: 'invalid_password' };
    }
    return { ok: false, error: 'unauthorized' };
  }

  const { updateData } = resolveStaffPasswordChangeSuccess(user, meta);
  const { error } = await supabase.auth.updateUser(
    updateData ? { password: newPassword, data: updateData } : { password: newPassword },
  );
  if (error) {
    return { ok: false, error: 'update_failed' };
  }

  let path: string | null = null;
  if (meta) {
    try {
      const admin = createAdminClient();
      const staff = await loadStaffGateAccountForUser(admin, user.id);
      if (staff) {
        path = await resolveStaffLandingPath(admin, staff, meta.restaurant_slug);
      }
    } catch {
      path = null;
    }
  }

  return { ok: true, path };
}
