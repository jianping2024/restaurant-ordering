import type { User } from '@supabase/supabase-js';
import type { StaffUserMetadata } from '../staff-account';

/** Pure post-auth metadata patch for staff password change. Landing path is resolved separately from capabilities. */
export function resolveStaffPasswordChangeSuccess(
  user: User,
  meta: StaffUserMetadata | null,
): { updateData: Record<string, unknown> | undefined } {
  if (meta) {
    return {
      updateData: { ...user.user_metadata, must_change_password: false },
    };
  }
  return { updateData: undefined };
}
