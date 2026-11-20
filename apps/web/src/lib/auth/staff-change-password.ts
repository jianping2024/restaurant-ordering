import type { SupabaseClient } from '@supabase/supabase-js';
import { loadStaffIdentity, setStaffMustChangePassword } from '@mesa/shared';
import { verifyStaffPassword } from '@/lib/verify-staff-password';
import {
  validateStaffPasswordChangeInput,
  type StaffChangePasswordValidationError,
} from '@/lib/auth/staff-change-password-validation';
import { staffLoginNameFromAuthEmail } from '@/lib/auth/resolve-auth-identifier';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolvePostLoginRedirect } from '@/lib/auth/post-login-redirect';

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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: 'unauthorized' };
  }

  const loginName = staffLoginNameFromAuthEmail(user.email ?? '');

  const validationError = validateStaffPasswordChangeInput({
    currentPassword,
    newPassword,
    confirmPassword,
    loginName,
  });
  if (validationError) {
    return { ok: false, error: validationError };
  }

  const verify = await verifyStaffPassword(currentPassword);
  if (!verify.ok) {
    if (verify.error === 'invalid_password') {
      return { ok: false, error: 'invalid_password' };
    }
    return { ok: false, error: 'unauthorized' };
  }

  let admin: ReturnType<typeof createAdminClient>;
  let identity: Awaited<ReturnType<typeof loadStaffIdentity>>;
  try {
    admin = createAdminClient();
    identity = await loadStaffIdentity(admin, user.id);
  } catch {
    return { ok: false, error: 'update_failed' };
  }

  // Staff: also clear the legacy metadata mirror (rollback compatibility §5.4; never read).
  const { error } = await supabase.auth.updateUser(
    identity
      ? {
          password: newPassword,
          data: { ...user.user_metadata, must_change_password: false },
        }
      : { password: newPassword },
  );
  if (error) {
    return { ok: false, error: 'update_failed' };
  }

  // Account-level flag lives in staff_identities (no browser grant → admin client).
  let path: string | null = null;
  try {
    if (identity) {
      if (identity.must_change_password) {
        await setStaffMustChangePassword(admin, user.id, false);
      }
      const landing = await resolvePostLoginRedirect(
        supabase,
        user.id,
        user.user_metadata as Record<string, unknown> | undefined,
        { email: user.email ?? null },
      );
      if (landing.kind === 'staff') path = landing.path;
    }
  } catch {
    return { ok: false, error: 'update_failed' };
  }

  return { ok: true, path };
}
